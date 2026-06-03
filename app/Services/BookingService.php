<?php

namespace App\Services;

use App\Events\BookingCreated;
use App\Events\BookingStatusChanged;
use App\Events\ScheduleUpdated;
use App\Models\Booking;
use App\Models\BookingSlot;
use App\Models\User;
use App\Support\PublicCache;
use Carbon\Carbon;
use Illuminate\Database\QueryException;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Throwable;

/**
 * Centralizes booking lifecycle: create from public form, status transitions,
 * audit-log writes, and broadcast events. Controllers stay thin.
 */
class BookingService
{
    public const SLOT_CAPACITY = 80;

    public function __construct(
        private readonly BookingCodeGenerator $codes,
        private readonly ScheduleService $schedule,
    ) {}

    public function createFromPublic(array $data, UploadedFile $document): Booking
    {
        $date = Carbon::createFromFormat('Y-m-d', $data['date'], 'Asia/Jakarta')->startOfDay();
        $this->schedule->ensureHolidayDataForDate($date);
        $documentPath = null;

        try {
            $code = $this->codes->next();
            $storedName = $code.'-'.Str::uuid().'.'.strtolower($document->getClientOriginalExtension());
            $documentPath = $document->storeAs('booking-letters', $storedName, 'local');

            return DB::transaction(function () use ($data, $document, $date, $documentPath, $code) {
                $segments = $this->buildSlotSegments($date, $data['time'], (int) $data['groupSize'], true);

                $booking = new Booking;
                $booking->code = $code;
                $booking->contact_name = $data['contactName'];
                $booking->nik = $data['nik']; // accessor encrypts + masks
                $booking->whatsapp = $data['whatsapp'];
                $booking->institution = $data['institution'];
                $booking->group_size = (int) $data['groupSize'];
                $booking->date = $date;
                $booking->date_label = $this->schedule->formatLongDate($date);
                $booking->time = $segments[0]['time'];
                $booking->status = 'Pending';
                $booking->document_path = $documentPath;
                $booking->document_original_name = $document->getClientOriginalName();
                $booking->feedback_token = $this->codes->token();
                $booking->submitted_at = now();
                $booking->save();
                $this->persistBookingSlots($booking, $segments, true);

                $this->logAudit(null, "Booking baru {$booking->code} dari {$booking->institution}", $booking);

                $this->broadcastAfterCommit(fn () => BookingCreated::dispatch($booking->fresh()->load('slots')), $booking);

                return $booking->fresh()->load('slots');
            });
        } catch (Throwable $exception) {
            if ($documentPath) {
                Storage::disk('local')->delete($documentPath);
            }

            if ($exception instanceof QueryException && $this->isUniqueSlotConflict($exception)) {
                $this->throwUnavailableSlot();
            }

            throw $exception;
        }
    }

    public function accept(Booking $booking, ?User $actor, ?string $note = null): Booking
    {
        return $this->transitionTo($booking, 'Accepted', $actor, 'accept', $note);
    }

    public function reject(Booking $booking, ?User $actor, ?string $note = null): Booking
    {
        return $this->transitionTo($booking, 'Rejected', $actor, 'reject', $note);
    }

    public function complete(Booking $booking, ?User $actor, ?string $note = null): Booking
    {
        return $this->transitionTo($booking, 'Completed', $actor, 'complete', $note);
    }

    public function expireStalePending(?Carbon $now = null): int
    {
        $now = ($now ?? now('Asia/Jakarta'))->copy()->timezone('Asia/Jakarta');
        $today = $now->toDateString();
        $time = $now->format('H.i');
        $expired = 0;

        Booking::query()
            ->where('status', 'Pending')
            ->where(function ($query) use ($today, $time) {
                $query->whereDate('date', '<', $today)
                    ->orWhere(function ($sameDay) use ($today, $time) {
                        $sameDay->whereDate('date', $today)
                            ->where('time', '<=', $time);
                    });
            })
            ->orderBy('id')
            ->chunkById(100, function ($bookings) use ($now, &$expired) {
                foreach ($bookings as $candidate) {
                    DB::transaction(function () use ($candidate, $now, &$expired) {
                        $booking = Booking::with('slots')
                            ->whereKey($candidate->id)
                            ->lockForUpdate()
                            ->first();

                        if (! $booking || $booking->status !== 'Pending' || ! $booking->hasVisitStarted($now)) {
                            return;
                        }

                        $previous = $booking->status;
                        $booking->status = 'Expired';
                        $booking->expired_at = $now;
                        $booking->save();
                        $this->syncBookingSlotKeys($booking);

                        $this->logAudit(null, "Menandai kedaluwarsa booking {$booking->code}", $booking, [
                            'expired_at' => $booking->expired_at?->toDateTimeString(),
                        ]);
                        $this->broadcastAfterCommit(fn () => BookingStatusChanged::dispatch($booking->fresh()->load('slots'), $previous, 'expire'), $booking);

                        $expired++;
                    });
                }
            });

        return $expired;
    }

    public function reschedule(
        Booking $booking,
        ?User $actor,
        string $proposedDate,
        string $proposedTime,
        ?string $note = null,
    ): Booking {
        $booking->proposed_date = $proposedDate;
        $booking->proposed_time = $proposedTime;
        $booking->proposed_date_label = $this->schedule->formatLongDate(Carbon::createFromFormat('Y-m-d', $proposedDate, 'Asia/Jakarta')->startOfDay());
        $booking->proposed_segments = $this->buildSlotSegments(
            Carbon::createFromFormat('Y-m-d', $proposedDate, 'Asia/Jakarta')->startOfDay(),
            $proposedTime,
            $booking->group_size,
            false,
            $booking->id,
        );
        $booking->proposed_at = now();

        return $this->transitionTo($booking, 'Reschedule', $actor, 'reschedule', $note);
    }

    public function cancelReschedule(Booking $booking, ?User $actor, ?string $note = null): Booking
    {
        return DB::transaction(function () use ($booking, $actor, $note) {
            $booking = Booking::with('slots')
                ->whereKey($booking->id)
                ->lockForUpdate()
                ->firstOrFail();
            $affectedScheduleDates = $this->scheduleDatesForBooking($booking);

            if ($booking->status !== 'Reschedule') {
                throw ValidationException::withMessages([
                    'status' => ["Status {$booking->status} tidak dapat membatalkan usulan reschedule."],
                ]);
            }

            $booking->status = $booking->reschedule_previous_status ?: 'Accepted';
            $booking->proposed_date = null;
            $booking->proposed_time = null;
            $booking->proposed_date_label = null;
            $booking->proposed_segments = null;
            $booking->proposed_at = null;
            $booking->reschedule_previous_status = null;
            if ($note !== null) {
                $booking->note = $note;
            }
            $booking->save();
            $booking->slots()->where('kind', BookingSlot::KIND_PROPOSED)->delete();
            $this->syncBookingSlotKeys($booking);

            $this->logAudit($actor, "Membatalkan usulan reschedule booking {$booking->code}", $booking);
            $this->broadcastAfterCommit(fn () => BookingStatusChanged::dispatch($booking->fresh()->load('slots'), 'Reschedule', 'reschedule-cancel'), $booking, $affectedScheduleDates);

            return $booking->fresh()->load('slots');
        });
    }

    /**
     * Manual admin override for urgent operational cases, e.g. merging machine
     * generated kloters from 3 slots into 2 larger slots after user contact.
     *
     * @param  array<int, array{date:string,time:string,groupSize:int}>  $segments
     */
    public function overrideSegments(
        Booking $booking,
        ?User $actor,
        array $segments,
        ?int $groupSize = null,
        ?string $note = null,
        bool $allowOverbook = false,
    ): Booking {
        return DB::transaction(function () use ($booking, $actor, $segments, $groupSize, $note, $allowOverbook) {
            $booking = Booking::with('slots')
                ->whereKey($booking->id)
                ->lockForUpdate()
                ->firstOrFail();
            $affectedScheduleDates = $this->scheduleDatesForBooking($booking);

            if (! in_array($booking->status, ['Pending', 'Accepted', 'Reschedule'], true)) {
                throw ValidationException::withMessages([
                    'status' => ["Status {$booking->status} tidak dapat diubah pembagian kloternya."],
                ]);
            }

            $oldGroupSize = (int) $booking->group_size;
            $targetGroupSize = $groupSize ?? $oldGroupSize;
            $total = collect($segments)->sum(fn (array $segment) => (int) $segment['groupSize']);
            if ($total !== $targetGroupSize) {
                throw ValidationException::withMessages([
                    'segments' => ["Total peserta kloter ({$total}) harus sama dengan jumlah rombongan ({$targetGroupSize})."],
                ]);
            }

            $normalized = collect($segments)
                ->groupBy(fn (array $segment): string => $segment['date'].'|'.$segment['time'])
                ->values()
                ->map(function ($group, int $index) {
                    $first = $group->first();
                    $date = Carbon::createFromFormat('Y-m-d', $first['date'], 'Asia/Jakarta')->startOfDay();

                    return [
                        'slot_order' => $index + 1,
                        'date' => $date->toDateString(),
                        'date_label' => $this->schedule->formatLongDate($date),
                        'time' => $first['time'],
                        'group_size' => $group->sum(fn (array $segment): int => (int) $segment['groupSize']),
                    ];
                })->all();

            $hasOversizedSegment = collect($normalized)->contains(fn (array $segment): bool => $segment['group_size'] > self::SLOT_CAPACITY);
            $hasGroupSizeChange = $targetGroupSize !== $oldGroupSize;

            $this->lockSlotKeysForSegments($normalized);
            $conflicts = $this->assertManualSegmentsUsable($booking, $normalized, $allowOverbook);
            if (($hasGroupSizeChange || $hasOversizedSegment || $conflicts !== []) && trim((string) $note) === '') {
                throw ValidationException::withMessages([
                    'note' => ['Catatan wajib diisi saat mengubah jumlah peserta, mengizinkan overbook, atau menggabungkan kloter besar.'],
                ]);
            }

            $first = $normalized[0];
            $booking->group_size = $targetGroupSize;
            $booking->date = Carbon::createFromFormat('Y-m-d', $first['date'], 'Asia/Jakarta')->startOfDay();
            $booking->date_label = $first['date_label'];
            $booking->time = $first['time'];
            if ($note !== null) {
                $booking->note = $note;
            }
            $booking->save();

            $this->persistBookingSlots($booking, $normalized, $booking->isActiveForSchedule());
            $description = $conflicts === []
                ? "Mengubah pembagian kloter booking {$booking->code}"
                : "Mengubah pembagian kloter booking {$booking->code} dengan overbook manual";
            $this->logAudit($actor, $description, $booking, [
                'overbook' => $conflicts !== [],
                'conflicts' => $conflicts,
                'old_group_size' => $oldGroupSize,
                'new_group_size' => $targetGroupSize,
                'note' => $note,
            ]);
            $this->broadcastAfterCommit(fn () => BookingStatusChanged::dispatch($booking->fresh()->load('slots'), $booking->status, 'segments'), $booking, $affectedScheduleDates);

            return $booking->fresh()->load('slots');
        });
    }

    private function transitionTo(
        Booking $booking,
        string $newStatus,
        ?User $actor,
        string $action,
        ?string $note = null,
    ): Booking {
        try {
            return DB::transaction(function () use ($booking, $newStatus, $actor, $action, $note) {
                $preparedProposal = null;
                if ($newStatus === 'Reschedule') {
                    $preparedProposal = [
                        'proposed_date' => $booking->proposed_date,
                        'proposed_time' => $booking->proposed_time,
                        'proposed_date_label' => $booking->proposed_date_label,
                        'proposed_segments' => $booking->proposed_segments,
                        'proposed_at' => $booking->proposed_at,
                        'reschedule_previous_status' => $booking->status,
                    ];
                }

                $booking = Booking::with('slots')
                    ->whereKey($booking->id)
                    ->lockForUpdate()
                    ->firstOrFail();
                $affectedScheduleDates = $this->scheduleDatesForBooking($booking);

                if ($preparedProposal !== null) {
                    $booking->proposed_date = $preparedProposal['proposed_date'];
                    $booking->proposed_time = $preparedProposal['proposed_time'];
                    $booking->proposed_date_label = $preparedProposal['proposed_date_label'];
                    $booking->proposed_segments = $preparedProposal['proposed_segments'];
                    $booking->proposed_at = $preparedProposal['proposed_at'];
                    $booking->reschedule_previous_status = $booking->reschedule_previous_status ?: $preparedProposal['reschedule_previous_status'];
                }

                $previous = $booking->status;
                if ($action === 'accept') {
                    $this->assertPendingBookingCanBeAccepted($booking);
                }
                $this->assertValidTransition($previous, $newStatus);
                $replacementSegments = null;

                if ($newStatus === 'Accepted' && $booking->status === 'Reschedule' && $booking->proposed_date && $booking->proposed_time) {
                    $replacementSegments = $this->proposedSlotsAsSegments($booking);
                    if ($replacementSegments === []) {
                        $proposedDate = Carbon::parse($booking->proposed_date, 'Asia/Jakarta')->startOfDay();
                        $replacementSegments = $this->buildSlotSegments($proposedDate, $booking->proposed_time, $booking->group_size, true, $booking->id);
                    }

                    $this->lockSlotKeysForSegments($replacementSegments);

                    $booking->date = Carbon::createFromFormat('Y-m-d', $replacementSegments[0]['date'], 'Asia/Jakarta')->startOfDay();
                    $booking->date_label = $replacementSegments[0]['date_label'];
                    $booking->time = $replacementSegments[0]['time'];
                    $booking->proposed_date = null;
                    $booking->proposed_time = null;
                    $booking->proposed_date_label = null;
                    $booking->proposed_segments = null;
                    $booking->proposed_at = null;
                    $booking->reschedule_previous_status = null;
                }

                if ($newStatus === 'Reschedule' && $booking->proposed_date && $booking->proposed_time) {
                    $proposedDate = Carbon::parse($booking->proposed_date, 'Asia/Jakarta')->startOfDay();
                    $booking->proposed_segments = $this->buildSlotSegments($proposedDate, $booking->proposed_time, $booking->group_size, true, $booking->id);
                }

                if ($newStatus === 'Rejected') {
                    $booking->proposed_date = null;
                    $booking->proposed_time = null;
                    $booking->proposed_date_label = null;
                    $booking->proposed_segments = null;
                    $booking->proposed_at = null;
                    $booking->reschedule_previous_status = null;
                    $booking->rejected_at = now();
                    $booking->slots()->where('kind', BookingSlot::KIND_PROPOSED)->delete();
                }

                if ($newStatus === 'Completed') {
                    if ($booking->date && $booking->date->gt(Carbon::today('Asia/Jakarta'))) {
                        throw ValidationException::withMessages([
                            'status' => ['Booking belum dapat ditandai selesai sebelum tanggal kunjungan.'],
                        ]);
                    }
                    $booking->completed_at = now();
                }

                $booking->status = $newStatus;
                if ($note !== null) {
                    $booking->note = $note;
                }
                $booking->save();
                if ($replacementSegments !== null) {
                    $this->persistBookingSlots($booking, $replacementSegments, $booking->isActiveForSchedule());
                } else {
                    if ($newStatus === 'Reschedule' && $booking->proposed_segments) {
                        $this->persistProposedBookingSlots($booking, $booking->proposed_segments);
                    }
                    $this->syncBookingSlotKeys($booking);
                }

                $verb = match ($action) {
                    'accept' => 'Menyetujui',
                    'reject' => 'Menolak',
                    'complete' => 'Menandai selesai',
                    'reschedule' => 'Menjadwalkan ulang',
                    default => 'Mengubah',
                };
                $this->logAudit($actor, "{$verb} booking {$booking->code}", $booking);

                $this->broadcastAfterCommit(fn () => BookingStatusChanged::dispatch($booking->fresh()->load('slots'), $previous, $action), $booking, $affectedScheduleDates);

                return $booking->fresh()->load('slots');
            });
        } catch (QueryException $exception) {
            if ($this->isUniqueSlotConflict($exception)) {
                $this->throwUnavailableSlot();
            }

            throw $exception;
        }
    }

    private function assertValidTransition(string $currentStatus, string $newStatus): void
    {
        $allowed = match ($currentStatus) {
            'Pending' => ['Accepted', 'Rejected', 'Reschedule'],
            'Accepted' => ['Completed', 'Reschedule'],
            'Reschedule' => ['Accepted', 'Rejected', 'Reschedule'],
            'Expired' => ['Reschedule', 'Rejected'],
            default => [],
        };

        if (! in_array($newStatus, $allowed, true)) {
            throw ValidationException::withMessages([
                'status' => ["Status {$currentStatus} tidak dapat diubah menjadi {$newStatus}."],
            ]);
        }
    }

    /**
     * @param  array<int, string>  $affectedScheduleDates
     */
    private function broadcastAfterCommit(callable $callback, Booking $booking, array $affectedScheduleDates = []): void
    {
        PublicCache::bumpScheduleVersion();

        DB::afterCommit(function () use ($callback, $booking, $affectedScheduleDates) {
            PublicCache::bumpScheduleVersion();
            rescue($callback);
            rescue(function () use ($booking, $affectedScheduleDates) {
                $this->broadcastScheduleUpdated($booking->fresh(['slots']) ?? $booking, $affectedScheduleDates);
            });
        });
    }

    /**
     * @param  array<int, string>  $additionalDates
     */
    private function broadcastScheduleUpdated(Booking $booking, array $additionalDates = []): void
    {
        $dates = collect($additionalDates)
            ->merge($this->scheduleDatesForBooking($booking))
            ->filter()
            ->unique()
            ->sort()
            ->values();

        if ($dates->isEmpty()) {
            return;
        }

        ScheduleUpdated::dispatch($dates->first(), $dates->last());
    }

    /**
     * @return array<int, string>
     */
    private function scheduleDatesForBooking(Booking $booking): array
    {
        $dates = collect();

        if ($booking->date) {
            $dates->push($booking->date->toDateString());
        }

        if ($booking->proposed_date) {
            $dates->push($booking->proposed_date->toDateString());
        }

        collect($booking->proposed_segments ?? [])
            ->pluck('date')
            ->each(fn (?string $date) => $dates->push($date));

        $slots = $booking->relationLoaded('slots') ? $booking->slots : $booking->slots()->get();
        $slots->each(fn (BookingSlot $slot) => $dates->push($slot->date?->toDateString()));

        return $dates
            ->filter()
            ->unique()
            ->sort()
            ->values()
            ->all();
    }

    private function assertPendingBookingCanBeAccepted(Booking $booking): void
    {
        if ($booking->status === 'Pending' && $booking->hasVisitStarted()) {
            throw ValidationException::withMessages([
                'status' => ['Jadwal kunjungan sudah terlewat. Tawarkan jadwal baru atau biarkan booking kedaluwarsa.'],
            ]);
        }
    }

    /**
     * @return array<int, array{slot_order:int,date:string,date_label:string,time:string,group_size:int}>
     */
    private function buildSlotSegments(
        Carbon $date,
        string $startTime,
        int $groupSize,
        bool $lockBookings = false,
        ?int $ignoreBookingId = null,
    ): array {
        $segmentSizes = $this->splitGroupSizes($groupSize);
        $requiredSlots = count($segmentSizes);
        $times = $this->schedule->orderedTimesForDate($date);
        $startIndex = array_search($startTime, $times, true);

        if ($startIndex === false) {
            $this->throwUnavailableConsecutiveSlots($requiredSlots);
        }

        $selectedTimes = array_slice($times, $startIndex, $requiredSlots);
        if (count($selectedTimes) < $requiredSlots) {
            $this->throwUnavailableConsecutiveSlots($requiredSlots);
        }

        if ($lockBookings) {
            $this->lockSlotKeys($date->toDateString(), $selectedTimes);
        }

        $statuses = $this->schedule->slotStatusesFor($date, $selectedTimes, $lockBookings, $ignoreBookingId);
        if (collect($selectedTimes)->contains(fn (string $time): bool => ($statuses[$time] ?? 'Closed') !== 'Available')) {
            $this->throwUnavailableSlot();
        }

        $segments = [];
        foreach ($selectedTimes as $index => $time) {
            $segments[] = [
                'slot_order' => $index + 1,
                'date' => $date->toDateString(),
                'date_label' => $this->schedule->formatLongDate($date),
                'time' => $time,
                'group_size' => $segmentSizes[$index],
            ];
        }

        return $segments;
    }

    /**
     * @return array<int, int>
     */
    private function splitGroupSizes(int $groupSize): array
    {
        if ($groupSize < 1) {
            return [0];
        }

        $requiredSlots = max(1, (int) ceil($groupSize / self::SLOT_CAPACITY));
        $baseSize = intdiv($groupSize, $requiredSlots);
        $remainder = $groupSize % $requiredSlots;

        return array_map(
            fn (int $index): int => $baseSize + ($index < $remainder ? 1 : 0),
            range(0, $requiredSlots - 1),
        );
    }

    /**
     * @param  array<int, array{slot_order:int,date:string,date_label:string,time:string,group_size:int}>  $segments
     */
    private function persistBookingSlots(Booking $booking, array $segments, bool $active): void
    {
        $booking->slots()->where('kind', BookingSlot::KIND_ACTIVE)->delete();
        $booking->slots()->where('kind', BookingSlot::KIND_PROPOSED)->delete();

        foreach ($segments as $segment) {
            $booking->slots()->create([
                'kind' => BookingSlot::KIND_ACTIVE,
                'slot_order' => $segment['slot_order'],
                'date' => $segment['date'],
                'date_label' => $segment['date_label'],
                'time' => $segment['time'],
                'group_size' => $segment['group_size'],
                'active_slot_key' => $active ? BookingSlot::slotKey($segment['date'], $segment['time']) : null,
            ]);
        }
    }

    private function persistProposedBookingSlots(Booking $booking, array $segments): void
    {
        $booking->slots()->where('kind', BookingSlot::KIND_PROPOSED)->delete();

        foreach ($segments as $segment) {
            $booking->slots()->create([
                'kind' => BookingSlot::KIND_PROPOSED,
                'slot_order' => $segment['slot_order'] ?? $segment['order'],
                'date' => $segment['date'],
                'date_label' => $segment['date_label'] ?? $segment['dateLabel'],
                'time' => $segment['time'],
                'group_size' => $segment['group_size'] ?? $segment['groupSize'],
                'active_slot_key' => BookingSlot::slotKey($segment['date'], $segment['time']),
            ]);
        }
    }

    private function proposedSlotsAsSegments(Booking $booking): array
    {
        return $booking->slots()
            ->where('kind', BookingSlot::KIND_PROPOSED)
            ->orderBy('slot_order')
            ->get()
            ->map(fn (BookingSlot $slot) => [
                'slot_order' => $slot->slot_order,
                'date' => $slot->date->toDateString(),
                'date_label' => $slot->date_label,
                'time' => $slot->time,
                'group_size' => $slot->group_size,
            ])
            ->all();
    }

    private function syncBookingSlotKeys(Booking $booking): void
    {
        $active = $booking->isActiveForSchedule();
        $booking->slots()->get()->each(function (BookingSlot $slot) use ($active) {
            $slot->active_slot_key = ($active || $slot->kind === BookingSlot::KIND_PROPOSED)
                ? BookingSlot::slotKey($slot->date, $slot->time)
                : null;
            $slot->save();
        });
    }

    private function assertSlotAvailable(Carbon $date, string $time, bool $lockBookings = false, ?int $ignoreBookingId = null): void
    {
        if ($this->schedule->slotStatusFor($date, $time, $lockBookings, $ignoreBookingId) !== 'Available') {
            $this->throwUnavailableSlot();
        }
    }

    /**
     * @param  array<int, array{date:string,time:string}>  $segments
     */
    private function lockSlotKeysForSegments(array $segments): void
    {
        $slotKeys = collect($segments)
            ->map(fn (array $segment): ?string => BookingSlot::slotKey($segment['date'], $segment['time']))
            ->filter()
            ->values()
            ->all();

        $this->lockSlotKeys($slotKeys);
    }

    /**
     * @param  array<int, string>|string  $dateOrSlotKeys
     * @param  array<int, string>|null  $times
     */
    private function lockSlotKeys(array|string $dateOrSlotKeys, ?array $times = null): void
    {
        $slotKeys = $times === null
            ? $dateOrSlotKeys
            : collect($times)->map(fn (string $time): ?string => BookingSlot::slotKey($dateOrSlotKeys, $time))->all();

        $slotKeys = collect($slotKeys)
            ->filter()
            ->unique()
            ->sort()
            ->values();

        if ($slotKeys->isEmpty()) {
            return;
        }

        $timestamp = now();
        DB::table('booking_slot_locks')->upsert(
            $slotKeys->map(fn (string $slotKey): array => [
                'slot_key' => $slotKey,
                'created_at' => $timestamp,
                'updated_at' => $timestamp,
            ])->all(),
            ['slot_key'],
            ['updated_at'],
        );

        DB::table('booking_slot_locks')
            ->whereIn('slot_key', $slotKeys->all())
            ->orderBy('slot_key')
            ->lockForUpdate()
            ->get();
    }

    /**
     * @param  array<int, array{slot_order:int,date:string,date_label:string,time:string,group_size:int}>  $segments
     * @return array<int, array{date:string,time:string,status:string}>
     */
    private function assertManualSegmentsUsable(Booking $booking, array $segments, bool $allowOverbook): array
    {
        $conflicts = [];

        foreach (collect($segments)->groupBy('date') as $dateKey => $dateSegments) {
            $date = Carbon::createFromFormat('Y-m-d', $dateKey, 'Asia/Jakarta')->startOfDay();
            $times = $dateSegments->pluck('time')->all();
            $statuses = $this->schedule->slotStatusesFor($date, $times, true, $booking->id);

            foreach ($times as $time) {
                $status = $statuses[$time] ?? 'Closed';
                if ($status === 'Closed') {
                    throw ValidationException::withMessages([
                        'segments' => ["Slot {$dateKey} {$time} sedang tutup. Buka slot jadwal terlebih dahulu sebelum mengatur kloter."],
                    ]);
                }

                if ($status !== 'Available') {
                    $conflicts[] = [
                        'date' => $dateKey,
                        'time' => $time,
                        'status' => $status,
                    ];
                }
            }
        }

        if ($conflicts !== [] && ! $allowOverbook) {
            throw ValidationException::withMessages([
                'allowOverbook' => ['Slot yang dipilih sudah terisi. Centang izin overbook dan isi alasan untuk menggabungkan rombongan.'],
            ]);
        }

        return $conflicts;
    }

    private function throwUnavailableSlot(): never
    {
        throw ValidationException::withMessages([
            'time' => ['Jadwal yang dipilih sudah tidak tersedia. Silakan pilih slot lain.'],
        ]);
    }

    private function throwUnavailableConsecutiveSlots(int $requiredSlots): never
    {
        throw ValidationException::withMessages([
            'time' => ["Rombongan ini membutuhkan {$requiredSlots} slot layanan tersedia. Pilih jam mulai lain yang masih tersedia."],
        ]);
    }

    private function isUniqueSlotConflict(QueryException $exception): bool
    {
        $code = (string) $exception->getCode();
        $message = $exception->getMessage();

        return in_array($code, ['23000', '23505'], true)
            && str_contains($message, 'active_slot_key');
    }

    private function logAudit(?User $actor, string $description, Booking $booking, array $payload = []): void
    {
        AuditLogger::record($actor, $description, Booking::class, $booking->code, array_merge([
            'status' => $booking->status,
        ], $payload));
    }
}
