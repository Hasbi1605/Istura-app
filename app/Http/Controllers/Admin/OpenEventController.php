<?php

namespace App\Http\Controllers\Admin;

use App\Events\OpenQuotaUpdated;
use App\Events\ScheduleUpdated;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\StoreOpenEventRequest;
use App\Http\Requests\Admin\UpdateOpenEventDayRequest;
use App\Http\Requests\Admin\UpdateOpenEventRequest;
use App\Http\Resources\OpenEventDayResource;
use App\Http\Resources\OpenEventResource;
use App\Http\Resources\OpenRegistrationResource;
use App\Models\Booking;
use App\Models\BookingSlot;
use App\Models\OpenEvent;
use App\Models\OpenEventDay;
use App\Services\AuditLogger;
use App\Services\CmsImageService;
use App\Services\OpenRegistrationService;
use App\Support\PublicCache;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class OpenEventController extends Controller
{
    public function __construct(
        private readonly OpenRegistrationService $service,
        private readonly CmsImageService $cmsImages,
    ) {}

    public function index(): JsonResponse
    {
        $events = OpenEvent::with('days')->withCount('registrations')->latest('id')->get();

        return response()->json([
            'data' => OpenEventResource::collection($events)->resolve(),
            'quota' => $events->mapWithKeys(fn (OpenEvent $event) => [
                $event->id => $this->service->quotaSummary($event),
            ]),
        ]);
    }

    public function store(StoreOpenEventRequest $request): JsonResponse
    {
        $data = $request->validated();
        $dates = $this->selectedDates($data);

        $event = DB::transaction(function () use ($data, $dates, $request) {
            $event = new OpenEvent;
            $event->name = $data['name'];
            $event->slug = $this->uniqueSlug($data['name']);
            $event->start_date = $dates[0];
            $event->end_date = $dates[array_key_last($dates)];
            $event->per_day_quota = $data['perDayQuota'];
            $event->max_addons = $data['maxAddons'];
            $event->assignment_mode = $data['assignmentMode'] ?? 'self_select';
            $event->release_mode = $data['releaseMode'] ?? 'simultaneous';
            $event->registration_opens_at = $data['registrationOpensAt'] ?? null;
            $event->registration_closes_at = $data['registrationClosesAt'] ?? null;
            $event->agreement_text = $data['agreementText'] ?? null;
            $event->promo_subtitle = $data['promoSubtitle'] ?? null;
            $event->banner_text = $data['bannerText'] ?? null;
            $event->is_active = false;
            $event->save();

            $this->syncDays($event, $dates);

            AuditLogger::record($request->user(), "Membuat event Istura Open {$event->name}", 'open_event', $event->id, [], $request);

            return $event;
        });

        PublicCache::bumpScheduleVersion();

        return response()->json([
            'data' => (new OpenEventResource($event->fresh('days')))->resolve(),
        ], 201);
    }

    public function update(UpdateOpenEventRequest $request, OpenEvent $event): JsonResponse
    {
        $this->ensureOperationallyMutable($event);

        $data = $request->validated();
        $updatesDates = array_key_exists('dates', $data) || array_key_exists('startDate', $data) || array_key_exists('endDate', $data);
        $previousScheduleDates = $event->is_active && $updatesDates ? $this->openScheduleDates($event) : [];

        DB::transaction(function () use ($event, $data, $request) {
            $selectedDates = array_key_exists('dates', $data) ? $this->selectedDates($data) : null;

            $event->fill(array_filter([
                'name' => $data['name'] ?? null,
                'start_date' => $selectedDates[0] ?? $data['startDate'] ?? null,
                'end_date' => $selectedDates !== null ? $selectedDates[array_key_last($selectedDates)] : ($data['endDate'] ?? null),
                'per_day_quota' => $data['perDayQuota'] ?? null,
                'max_addons' => $data['maxAddons'] ?? null,
                'assignment_mode' => $data['assignmentMode'] ?? null,
                'release_mode' => $data['releaseMode'] ?? null,
            ], fn ($value) => $value !== null));

            foreach (['registrationOpensAt' => 'registration_opens_at', 'registrationClosesAt' => 'registration_closes_at', 'agreementText' => 'agreement_text', 'promoSubtitle' => 'promo_subtitle', 'bannerText' => 'banner_text'] as $input => $column) {
                if (array_key_exists($input, $data)) {
                    $event->{$column} = $data[$input];
                }
            }

            $event->save();

            if ($selectedDates !== null) {
                $this->syncDays($event, $selectedDates);
            } elseif (array_key_exists('startDate', $data) || array_key_exists('endDate', $data)) {
                $this->syncDays($event);
            }

            AuditLogger::record($request->user(), "Memperbarui event Istura Open {$event->name}", 'open_event', $event->id, [], $request);
        });

        PublicCache::bumpScheduleVersion();
        OpenQuotaUpdated::dispatch($event->slug);
        if ($event->is_active && $updatesDates) {
            $this->broadcastScheduleForDates([...$previousScheduleDates, ...$this->openScheduleDates($event->fresh('days'))]);
        }

        return response()->json([
            'data' => (new OpenEventResource($event->fresh('days')))->resolve(),
        ]);
    }

    public function activate(Request $request, OpenEvent $event): JsonResponse
    {
        $event->loadMissing('days');

        if ($event->isArchived()) {
            throw ValidationException::withMessages([
                'event' => ['Pulihkan event dari arsip sebelum mengaktifkannya.'],
            ]);
        }

        if ($event->isPast()) {
            throw ValidationException::withMessages([
                'event' => ['Event yang sudah lewat tidak dapat diaktifkan kembali.'],
            ]);
        }

        $openDaysMissingLink = $event->days
            ->filter(fn (OpenEventDay $day) => $day->is_open && blank($day->whatsapp_group_url));

        if ($openDaysMissingLink->isNotEmpty()) {
            throw ValidationException::withMessages([
                'days' => ['Setiap hari yang dibuka wajib memiliki link grup WhatsApp sebelum event diaktifkan.'],
            ]);
        }

        $affectedScheduleDates = OpenEvent::query()
            ->where('is_active', true)
            ->with('days')
            ->get()
            ->flatMap(fn (OpenEvent $activeEvent) => $this->openScheduleDates($activeEvent))
            ->all();

        DB::transaction(function () use ($event, $request) {
            OpenEvent::where('id', '!=', $event->id)->where('is_active', true)->update(['is_active' => false]);
            $event->is_active = true;
            $event->archived_at = null;
            $event->save();

            AuditLogger::record($request->user(), "Mengaktifkan event Istura Open {$event->name}", 'open_event', $event->id, [], $request);
        });

        PublicCache::bumpScheduleVersion();
        OpenQuotaUpdated::dispatch($event->slug);
        $this->broadcastScheduleForDates([...$affectedScheduleDates, ...$this->openScheduleDates($event->fresh('days'))]);

        return response()->json([
            'data' => (new OpenEventResource($event->fresh('days')))->resolve(),
        ]);
    }

    public function deactivate(Request $request, OpenEvent $event): JsonResponse
    {
        $affectedScheduleDates = $this->openScheduleDates($event);
        $event->is_active = false;
        $event->save();

        AuditLogger::record($request->user(), "Menonaktifkan event Istura Open {$event->name}", 'open_event', $event->id, [], $request);
        PublicCache::bumpScheduleVersion();
        OpenQuotaUpdated::dispatch($event->slug);
        $this->broadcastScheduleForDates($affectedScheduleDates);

        return response()->json([
            'data' => (new OpenEventResource($event->fresh('days')))->resolve(),
        ]);
    }

    public function archive(Request $request, OpenEvent $event): JsonResponse
    {
        $affectedScheduleDates = $event->is_active ? $this->openScheduleDates($event) : [];

        $event->is_active = false;
        $event->archived_at = now();
        $event->save();

        AuditLogger::record($request->user(), "Mengarsipkan event Istura Open {$event->name}", 'open_event', $event->id, [], $request);
        PublicCache::bumpScheduleVersion();
        OpenQuotaUpdated::dispatch($event->slug);
        $this->broadcastScheduleForDates($affectedScheduleDates);

        return response()->json([
            'data' => (new OpenEventResource($event->fresh('days')))->resolve(),
        ]);
    }

    public function unarchive(Request $request, OpenEvent $event): JsonResponse
    {
        $event->archived_at = null;
        $event->is_active = false;
        $event->save();

        AuditLogger::record($request->user(), "Memulihkan arsip event Istura Open {$event->name}", 'open_event', $event->id, [], $request);
        PublicCache::bumpScheduleVersion();
        OpenQuotaUpdated::dispatch($event->slug);

        return response()->json([
            'data' => (new OpenEventResource($event->fresh('days')))->resolve(),
        ]);
    }

    public function updateDay(UpdateOpenEventDayRequest $request, OpenEvent $event, OpenEventDay $day): JsonResponse
    {
        abort_unless($day->open_event_id === $event->id, 404);
        $this->ensureOperationallyMutable($event);

        $data = $request->validated();
        $wasOpen = (bool) $day->is_open;

        $wantsOpen = array_key_exists('isOpen', $data) ? (bool) $data['isOpen'] : $day->is_open;
        $resultingUrl = array_key_exists('whatsappGroupUrl', $data) ? $data['whatsappGroupUrl'] : $day->whatsapp_group_url;

        if ($wantsOpen && blank($resultingUrl)) {
            throw ValidationException::withMessages([
                'whatsappGroupUrl' => ['Isi link grup WhatsApp sebelum membuka hari ini.'],
            ]);
        }

        // Opening a day for Istura Open silently closes it to new rombongan
        // bookings; warn (non-blocking) if active rombongan bookings already
        // sit on this date so the admin can reschedule them first.
        $isOpening = $wantsOpen && ! $day->is_open;
        $acknowledged = (bool) ($data['acknowledgeConflicts'] ?? false);
        $conflicts = [];

        if ($isOpening) {
            $conflicts = $this->bookingConflictsForDate($day->date?->toDateString());

            if ($conflicts !== [] && ! $acknowledged) {
                return response()->json([
                    'message' => 'Ada booking rombongan aktif pada tanggal ini.',
                    'errors' => ['isOpen' => ['Ada booking rombongan aktif pada tanggal ini.']],
                    'conflicts' => $conflicts,
                ], 422);
            }
        }

        if (array_key_exists('quotaOverride', $data)) {
            $day->quota_override = $data['quotaOverride'];
        }
        if (array_key_exists('whatsappGroupUrl', $data)) {
            $day->whatsapp_group_url = $data['whatsappGroupUrl'];
        }
        if (array_key_exists('opensAt', $data)) {
            $day->opens_at = $data['opensAt'];
        }
        if (array_key_exists('isOpen', $data)) {
            $day->is_open = (bool) $data['isOpen'];
        }
        $day->save();

        $auditMeta = [];
        if ($isOpening && $conflicts !== []) {
            $auditMeta['acknowledgedConflicts'] = array_column($conflicts, 'code');
        }

        AuditLogger::record($request->user(), "Memperbarui hari Istura Open {$day->date?->toDateString()}", 'open_event_day', $day->id, $auditMeta, $request);
        PublicCache::bumpScheduleVersion();
        OpenQuotaUpdated::dispatch($event->slug);
        if ($event->is_active && array_key_exists('isOpen', $data) && $wantsOpen !== $wasOpen) {
            $this->broadcastScheduleForDates([$day->date?->toDateString()]);
        }

        $day->setRelation('event', $event);

        return response()->json([
            'data' => (new OpenEventDayResource($day))->resolve(),
        ]);
    }

    public function destroy(Request $request, OpenEvent $event): JsonResponse
    {
        if ($event->is_active) {
            throw ValidationException::withMessages([
                'event' => ['Nonaktifkan event sebelum menghapusnya.'],
            ]);
        }

        $this->ensureOperationallyMutable($event);

        if ($event->registrations()->exists()) {
            throw ValidationException::withMessages([
                'event' => ['Event yang sudah memiliki pendaftar tidak dapat dihapus. Nonaktifkan dan simpan sebagai arsip.'],
            ]);
        }

        $posterPath = $event->poster_path;
        $eventName = $event->name;
        $eventId = $event->id;

        DB::transaction(function () use ($event, $eventName, $eventId, $request) {
            AuditLogger::record($request->user(), "Menghapus draft event Istura Open {$eventName}", 'open_event', $eventId, [], $request);
            $event->delete();
        });

        if ($posterPath) {
            Storage::disk('public')->delete($posterPath);
        }

        PublicCache::bumpScheduleVersion();

        return response()->json(['data' => ['deleted' => true]]);
    }

    /**
     * Registration rows for browser-side export (per day, with add-on names).
     */
    public function export(OpenEvent $event): JsonResponse
    {
        $registrations = $event->registrations()
            ->with('day')
            ->orderBy('assigned_event_day_id')
            ->orderBy('id')
            ->get();

        return response()->json([
            'data' => OpenRegistrationResource::collection($registrations)->resolve(),
            'event' => (new OpenEventResource($event->loadMissing('days')))->resolve(),
        ]);
    }

    public function uploadPoster(Request $request, OpenEvent $event): JsonResponse
    {
        $this->ensureOperationallyMutable($event);

        $request->validate([
            'poster' => [
                'required',
                'file',
                'image',
                'mimes:jpg,jpeg,png,webp',
                'max:5120',
                'dimensions:max_width='.CmsImageService::MAX_INPUT_WIDTH.',max_height='.CmsImageService::MAX_INPUT_HEIGHT,
            ],
        ], [
            'poster.required' => 'Pilih gambar poster terlebih dahulu.',
            'poster.uploaded' => 'Gambar gagal diunggah — ukuran melebihi batas server. Coba kompres atau perkecil gambar.',
            'poster.image' => 'File harus berupa gambar.',
            'poster.mimes' => 'Format gambar harus JPG, PNG, atau WebP.',
            'poster.max' => 'Ukuran gambar maksimal 5 MB.',
            'poster.dimensions' => 'Dimensi gambar maksimal '.CmsImageService::MAX_INPUT_WIDTH.'×'.CmsImageService::MAX_INPUT_HEIGHT.' piksel (potret atau lanskap sama-sama boleh).',
        ]);

        $oldPath = $event->poster_path;
        $newPath = $this->cmsImages->storePublicWebp(
            $request->file('poster'),
            'cms/open-posters',
            'poster',
            1280,
            1600,
        );

        try {
            $event->poster_path = $newPath;
            $event->save();
        } catch (\Throwable $exception) {
            Storage::disk('public')->delete($newPath);

            throw $exception;
        }

        if ($oldPath && $oldPath !== $newPath) {
            Storage::disk('public')->delete($oldPath);
        }

        AuditLogger::record($request->user(), "Mengunggah poster Istura Open {$event->name}", 'open_event', $event->id, [], $request);
        OpenQuotaUpdated::dispatch($event->slug);

        return response()->json([
            'data' => (new OpenEventResource($event->fresh('days')))->resolve(),
        ]);
    }

    public function deletePoster(Request $request, OpenEvent $event): JsonResponse
    {
        $this->ensureOperationallyMutable($event);

        $oldPath = $event->poster_path;

        $event->poster_path = null;
        $event->save();

        if ($oldPath) {
            Storage::disk('public')->delete($oldPath);
        }

        AuditLogger::record($request->user(), "Menghapus poster Istura Open {$event->name}", 'open_event', $event->id, [], $request);
        OpenQuotaUpdated::dispatch($event->slug);

        return response()->json([
            'data' => (new OpenEventResource($event->fresh('days')))->resolve(),
        ]);
    }

    /**
     * Active rombongan bookings that already sit on a given date, used to warn
     * the admin before opening that date for Istura Open. Covers multi-segment
     * bookings (booking_slots: active + proposed) and legacy single-date rows.
     *
     * @return array<int, array{code:string,time:?string,groupSize:int,status:string,statusLabel:string}>
     */
    private function bookingConflictsForDate(?string $dateKey): array
    {
        if (! $dateKey) {
            return [];
        }

        $items = [];
        $seenSlot = [];
        $seenBookingIds = [];

        $slots = BookingSlot::with('booking')
            ->whereDate('date', $dateKey)
            ->get()
            ->filter(fn (BookingSlot $slot) => $slot->kind === BookingSlot::KIND_PROPOSED || $slot->booking?->isActiveForSchedule());

        foreach ($slots as $slot) {
            $booking = $slot->booking;
            if (! $booking) {
                continue;
            }

            $key = $booking->id.'|'.$slot->time;
            if (isset($seenSlot[$key])) {
                continue;
            }
            $seenSlot[$key] = true;
            $seenBookingIds[$booking->id] = true;

            $items[] = $this->conflictItem($booking->code, $slot->time, (int) ($slot->group_size ?? $booking->group_size), $booking->status);
        }

        $bookings = Booking::whereDate('date', $dateKey)
            ->whereIn('status', Booking::ACTIVE_STATUSES)
            ->get();

        foreach ($bookings as $booking) {
            if (isset($seenBookingIds[$booking->id])) {
                continue;
            }

            $items[] = $this->conflictItem($booking->code, $booking->time, (int) $booking->group_size, $booking->status);
        }

        return $items;
    }

    /**
     * @return array{code:string,time:?string,groupSize:int,status:string,statusLabel:string}
     */
    private function conflictItem(string $code, ?string $time, int $groupSize, string $status): array
    {
        return [
            'code' => $code,
            'time' => $time,
            'groupSize' => $groupSize,
            'status' => $status,
            'statusLabel' => match ($status) {
                'Pending' => 'Menunggu',
                'Accepted' => 'Disetujui',
                'Reschedule' => 'Reschedule',
                default => $status,
            },
        ];
    }

    private function ensureOperationallyMutable(OpenEvent $event): void
    {
        if ($event->isArchived()) {
            throw ValidationException::withMessages([
                'event' => ['Event arsip bersifat baca-saja. Pulihkan arsip sebelum mengubah data operasional.'],
            ]);
        }

        if ($event->isPast()) {
            throw ValidationException::withMessages([
                'event' => ['Event yang sudah lewat bersifat baca-saja untuk mutasi operasional.'],
            ]);
        }
    }

    /**
     * @param  array<int, string>|null  $selectedDates
     */
    private function syncDays(OpenEvent $event, ?array $selectedDates = null): void
    {
        $wanted = $selectedDates;
        if ($wanted === null) {
            $start = Carbon::parse($event->start_date, 'Asia/Jakarta')->startOfDay();
            $end = Carbon::parse($event->end_date, 'Asia/Jakarta')->startOfDay();
            $wanted = [];
            for ($date = $start->copy(); $date->lte($end); $date->addDay()) {
                $wanted[] = $date->toDateString();
            }
        }

        $existingDays = $event->days()->withCount('registrations')->get();
        $existing = $existingDays
            ->map(fn (OpenEventDay $day) => $day->date?->toDateString())
            ->filter()
            ->all();

        foreach ($wanted as $date) {
            if (! in_array($date, $existing, true)) {
                $event->days()->create([
                    'date' => $date,
                    'is_open' => false,
                ]);
            }
        }

        $staleDays = $existingDays
            ->filter(fn (OpenEventDay $day) => ! in_array($day->date?->toDateString(), $wanted, true));
        $lockedDates = $staleDays
            ->filter(fn (OpenEventDay $day) => $day->registrations_count > 0)
            ->map(fn (OpenEventDay $day) => $day->date?->toDateString())
            ->filter()
            ->values()
            ->all();

        if ($lockedDates !== []) {
            throw ValidationException::withMessages([
                'dates' => ['Tanggal yang sudah memiliki pendaftar tidak dapat dihapus: '.implode(', ', $lockedDates).'.'],
            ]);
        }

        $staleIds = $staleDays
            ->pluck('id')
            ->all();

        if ($staleIds !== []) {
            OpenEventDay::whereIn('id', $staleIds)->delete();
        }
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<int, string>
     */
    private function selectedDates(array $data): array
    {
        if (isset($data['dates'])) {
            return collect($data['dates'])->unique()->sort()->values()->all();
        }

        $start = Carbon::parse($data['startDate'], 'Asia/Jakarta')->startOfDay();
        $end = Carbon::parse($data['endDate'], 'Asia/Jakarta')->startOfDay();
        $dates = [];
        for ($date = $start->copy(); $date->lte($end); $date->addDay()) {
            $dates[] = $date->toDateString();
        }

        return $dates;
    }

    /**
     * @return array<int, string>
     */
    private function openScheduleDates(OpenEvent $event): array
    {
        $event->loadMissing('days');

        return $event->days
            ->filter(fn (OpenEventDay $day) => $day->is_open)
            ->map(fn (OpenEventDay $day) => $day->date?->toDateString())
            ->filter()
            ->values()
            ->all();
    }

    /**
     * @param  array<int, string|null>  $dates
     */
    private function broadcastScheduleForDates(array $dates): void
    {
        $dates = collect($dates)->filter()->unique()->sort()->values();
        if ($dates->isEmpty()) {
            return;
        }

        ScheduleUpdated::dispatch($dates->first(), $dates->last());
    }

    private function uniqueSlug(string $name): string
    {
        $base = Str::slug($name) ?: 'istura-open';
        $slug = $base;
        $suffix = 1;

        while (OpenEvent::where('slug', $slug)->exists()) {
            $slug = $base.'-'.(++$suffix);
        }

        return $slug;
    }
}
