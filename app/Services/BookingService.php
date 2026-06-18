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
use Illuminate\Http\Request;
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

    public function createFromPublic(array $data, UploadedFile $document, ?Request $request = null): Booking
    {
        $date = Carbon::createFromFormat('Y-m-d', $data['date'], 'Asia/Jakarta')->startOfDay();
        $this->schedule->ensureHolidayDataForDate($date);
        $this->assertIdentityMayBook($data['nik'], $data['whatsapp']);
        $documentPath = null;

        try {
            $code = $this->codes->next();
            $storedName = $code.'-'.Str::uuid().'.'.strtolower($document->getClientOriginalExtension());
            $documentPath = $document->storeAs('booking-letters', $storedName, 'local');

            return DB::transaction(function () use ($data, $document, $date, $documentPath, $code, $request) {
                $this->assertIdentityMayBook($data['nik'], $data['whatsapp'], true);
                $segments = $this->buildSlotSegments($date, $data['time'], (int) $data['groupSize'], true, publicBooking: true);

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

                $this->logAudit(null, "Booking baru {$booking->code} dari {$booking->institution}", $booking, request: $request);

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

    public function createFromAdmin(array $data, User $actor, ?Request $request = null, ?UploadedFile $document = null): Booking
    {
        $date = Carbon::createFromFormat('Y-m-d', $data['date'], 'Asia/Jakarta')->startOfDay();
        $this->schedule->ensureHolidayDataForDate($date);
        $code = $this->codes->next();
        $documentPath = null;

        try {
            if ($document) {
                $storedName = $code.'-'.Str::uuid().'.'.strtolower($document->getClientOriginalExtension());
                $documentPath = $document->storeAs('booking-letters', $storedName, 'local');
            }

            return DB::transaction(function () use ($data, $actor, $request, $date, $code, $document, $documentPath) {
                $segments = $data['segments'] ?? null
                    ? $this->buildManualAdminSegments($data['segments'])
                    : $this->buildSequentialSegments($date, $data['time'], (int) $data['groupSize']);
                $this->lockSlotKeysForSegments($segments);
                $conflicts = $this->assertManualSegmentsUsable(new Booking, $segments, (bool) ($data['allowOverbook'] ?? false));
                $firstSegment = $segments[0];

                $booking = new Booking;
                $booking->code = $code;
                $booking->source = 'admin';
                $booking->created_by_admin_id = $actor->id;
                $booking->contact_name = $data['contactName'];
                $booking->nik = $data['nik'];
                $booking->whatsapp = $data['whatsapp'];
                $booking->institution = $data['institution'];
                $booking->group_size = (int) $data['groupSize'];
                $booking->date = $date;
                $booking->date_label = $this->schedule->formatLongDate($date);
                $booking->time = $firstSegment['time'];
                $booking->status = $data['status'];
                $booking->document_path = $documentPath;
                $booking->document_original_name = $document?->getClientOriginalName() ?? 'Tanpa surat (dibuat admin)';
                $booking->feedback_token = $this->codes->token();
                $booking->submitted_at = now();
                $adminNote = $this->adminBookingConfirmationNote($data, $conflicts, $document !== null, $segments);
                $booking->note = $this->appendAdminNote(null, $adminNote);
                $booking->save();
                $this->persistBookingSlots($booking, $segments, true);

                $this->logAudit($actor, "Membuat booking admin {$booking->code}", $booking, [
                    'source' => 'admin',
                    'confirmed_with_guest' => (bool) ($data['confirmedWithGuest'] ?? false),
                    'manual_booking_confirmed' => (bool) ($data['confirmManualBooking'] ?? false),
                    'overbook' => $conflicts !== [],
                    'conflicts' => $conflicts,
                    'segments' => $segments,
                    'has_document' => $document !== null,
                    'note' => $adminNote,
                ], $request);
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

    public function accept(Booking $booking, ?User $actor, ?string $note = null, ?Request $request = null): Booking
    {
        return $this->transitionTo($booking, 'Accepted', $actor, 'accept', $note, $request);
    }

    public function reject(Booking $booking, ?User $actor, ?string $note = null, ?Request $request = null): Booking
    {
        return $this->transitionTo($booking, 'Rejected', $actor, 'reject', $note, $request);
    }

    public function complete(Booking $booking, ?User $actor, ?string $note = null, ?Request $request = null, ?string $documentationLink = null): Booking
    {
        return $this->transitionTo($booking, 'Completed', $actor, 'complete', $note, $request, $documentationLink);
    }

    public function expireStalePending(?Carbon $now = null): int
    {
        $now = ($now ?? now('Asia/Jakarta'))->copy()->timezone('Asia/Jakarta');
        $today = $now->toDateString();
        $time = $now->format('H.i');
        $pendingTtlHours = (int) config('booking.pending_ttl_hours', 48);
        $pendingSubmittedBefore = $pendingTtlHours > 0
            ? $now->copy()->subHours($pendingTtlHours)
            : null;
        $expired = 0;

        Booking::query()
            ->where('status', 'Pending')
            ->where(function ($query) use ($today, $time, $pendingSubmittedBefore) {
                $query->whereDate('date', '<', $today)
                    ->orWhere(function ($sameDay) use ($today, $time) {
                        $sameDay->whereDate('date', $today)
                            ->where('time', '<=', $time);
                    });

                if ($pendingSubmittedBefore) {
                    $query->orWhere('submitted_at', '<=', $pendingSubmittedBefore);
                }
            })
            ->orderBy('id')
            ->chunkById(100, function ($bookings) use ($now, &$expired) {
                foreach ($bookings as $candidate) {
                    DB::transaction(function () use ($candidate, $now, &$expired) {
                        $booking = Booking::with('slots')
                            ->whereKey($candidate->id)
                            ->lockForUpdate()
                            ->first();

                        $expiredByVisitStart = $booking?->hasVisitStarted($now) ?? false;
                        $expiredByTtl = $booking && $this->isPendingOlderThanTtl($booking, $now);

                        if (! $booking || $booking->status !== 'Pending' || (! $expiredByVisitStart && ! $expiredByTtl)) {
                            return;
                        }

                        $previous = $booking->status;
                        $booking->status = 'Expired';
                        $booking->expired_at = $now;
                        $booking->save();
                        $this->syncBookingSlotKeys($booking);

                        $this->logAudit(null, "Menandai kedaluwarsa booking {$booking->code}", $booking, [
                            'expired_at' => $booking->expired_at?->toDateTimeString(),
                            'reason' => $expiredByTtl ? 'pending_ttl' : 'visit_started',
                        ]);
                        $this->broadcastAfterCommit(fn () => BookingStatusChanged::dispatch($booking->fresh()->load('slots'), $previous, 'expire'), $booking);

                        $expired++;
                    });
                }
            });

        return $expired;
    }

    public function expireStaleReschedules(?Carbon $now = null): int
    {
        $now = ($now ?? now('Asia/Jakarta'))->copy()->timezone('Asia/Jakarta');
        $today = $now->toDateString();
        $time = $now->format('H.i');
        $expired = 0;

        Booking::query()
            ->where('status', 'Reschedule')
            ->whereNotNull('proposed_date')
            ->whereNotNull('proposed_time')
            ->where(function ($query) use ($today, $time) {
                $query->whereDate('proposed_date', '<', $today)
                    ->orWhere(function ($sameDay) use ($today, $time) {
                        $sameDay->whereDate('proposed_date', $today)
                            ->where('proposed_time', '<=', $time);
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

                        if (! $booking || $booking->status !== 'Reschedule' || ! $booking->hasProposedVisitStarted($now)) {
                            return;
                        }

                        $affectedScheduleDates = $this->scheduleDatesForBooking($booking);
                        $nextStatus = $this->statusAfterStaleReschedule($booking, $now);
                        $proposal = [
                            'proposed_date' => $booking->proposed_date?->toDateString(),
                            'proposed_time' => $booking->proposed_time,
                            'restored_status' => $nextStatus,
                        ];

                        $booking->status = $nextStatus;
                        if ($nextStatus === 'Expired') {
                            $booking->expired_at = $now;
                        }
                        $booking->proposed_date = null;
                        $booking->proposed_time = null;
                        $booking->proposed_date_label = null;
                        $booking->proposed_segments = null;
                        $booking->proposed_at = null;
                        $booking->reschedule_previous_status = null;
                        $booking->save();
                        $booking->slots()->where('kind', BookingSlot::KIND_PROPOSED)->delete();
                        $this->syncBookingSlotKeys($booking);

                        $this->logAudit(null, "Menandai kedaluwarsa usulan reschedule booking {$booking->code}", $booking, $proposal);
                        $this->broadcastAfterCommit(fn () => BookingStatusChanged::dispatch($booking->fresh()->load('slots'), 'Reschedule', 'reschedule-expire'), $booking, $affectedScheduleDates);

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
        ?Request $request = null,
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

        return $this->transitionTo($booking, 'Reschedule', $actor, 'reschedule', $note, $request);
    }

    public function cancelReschedule(Booking $booking, ?User $actor, ?string $note = null, ?Request $request = null): Booking
    {
        return DB::transaction(function () use ($booking, $actor, $note, $request) {
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

            $this->logAudit($actor, "Membatalkan usulan reschedule booking {$booking->code}", $booking, request: $request);
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
        bool $correctGroupSize = false,
        bool $confirmRisk = false,
        ?Request $request = null,
    ): Booking {
        return DB::transaction(function () use ($booking, $actor, $segments, $groupSize, $note, $allowOverbook, $correctGroupSize, $confirmRisk, $request) {
            $booking = Booking::with('slots')
                ->whereKey($booking->id)
                ->lockForUpdate()
                ->firstOrFail();
            $affectedScheduleDates = $this->scheduleDatesForBooking($booking);

            if (! in_array($booking->status, ['Pending', 'Accepted'], true)) {
                throw ValidationException::withMessages([
                    'status' => ["Status {$booking->status} tidak dapat diubah pembagian kloternya."],
                ]);
            }

            $oldGroupSize = (int) $booking->group_size;
            $targetGroupSize = $groupSize ?? $oldGroupSize;
            if ($targetGroupSize !== $oldGroupSize && ! $correctGroupSize) {
                throw ValidationException::withMessages([
                    'correctGroupSize' => ['Aktifkan mode koreksi jumlah peserta untuk mengubah total rombongan.'],
                ]);
            }
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

            if (collect($normalized)->contains(fn (array $segment): bool => $segment['date'] !== $booking->date->toDateString())) {
                throw ValidationException::withMessages([
                    'segments' => ['Atur Kloter hanya dapat mengubah pembagian pada tanggal booking yang sama. Gunakan Pindah Jadwal Langsung untuk mengganti tanggal.'],
                ]);
            }

            $currentSegments = $booking->slots
                ->where('kind', BookingSlot::KIND_ACTIVE)
                ->sortBy('slot_order')
                ->values()
                ->map(fn (BookingSlot $slot): array => [
                    'date' => $slot->date->toDateString(),
                    'time' => $slot->time,
                    'group_size' => (int) $slot->group_size,
                ])->all();
            $nextSegments = collect($normalized)->map(fn (array $segment): array => [
                'date' => $segment['date'],
                'time' => $segment['time'],
                'group_size' => $segment['group_size'],
            ])->all();
            if ($targetGroupSize === $oldGroupSize && $currentSegments === $nextSegments) {
                throw ValidationException::withMessages([
                    'segments' => ['Tidak ada perubahan pembagian kloter untuk disimpan.'],
                ]);
            }

            $hasOversizedSegment = collect($normalized)->contains(fn (array $segment): bool => $segment['group_size'] > self::SLOT_CAPACITY);
            $hasGroupSizeChange = $targetGroupSize !== $oldGroupSize;

            $this->lockSlotKeysForSegments($normalized);
            $conflicts = $this->assertManualSegmentsUsable($booking, $normalized, $allowOverbook);
            $hasRisk = $hasGroupSizeChange || $hasOversizedSegment || $conflicts !== [];
            if ($hasRisk && ! $confirmRisk) {
                throw ValidationException::withMessages([
                    'confirmRisk' => ['Konfirmasi perubahan berisiko wajib dicentang.'],
                ]);
            }
            $adminNote = $hasRisk
                ? $this->segmentRiskConfirmationNote($oldGroupSize, $targetGroupSize, $normalized, $conflicts)
                : trim((string) $note);

            $first = $normalized[0];
            $booking->group_size = $targetGroupSize;
            $booking->date = Carbon::createFromFormat('Y-m-d', $first['date'], 'Asia/Jakarta')->startOfDay();
            $booking->date_label = $first['date_label'];
            $booking->time = $first['time'];
            if ($adminNote !== '') {
                $booking->note = $this->appendAdminNote($booking->note, $adminNote);
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
                'risk_confirmed' => $hasRisk ? $confirmRisk : false,
                'note' => $adminNote,
            ], $request);
            $this->broadcastAfterCommit(fn () => BookingStatusChanged::dispatch($booking->fresh()->load('slots'), $booking->status, 'segments'), $booking, $affectedScheduleDates);

            return $booking->fresh()->load('slots');
        });
    }

    public function moveDirectly(
        Booking $booking,
        ?User $actor,
        string $date,
        string $time,
        ?string $note = null,
        bool $allowOverbook = false,
        bool $confirmedDirectMove = false,
        ?Request $request = null,
    ): Booking {
        return DB::transaction(function () use ($booking, $actor, $date, $time, $note, $allowOverbook, $confirmedDirectMove, $request) {
            $booking = Booking::with('slots')->whereKey($booking->id)->lockForUpdate()->firstOrFail();
            if (! in_array($booking->status, ['Pending', 'Accepted'], true)) {
                throw ValidationException::withMessages([
                    'status' => ["Status {$booking->status} tidak dapat dipindahkan langsung."],
                ]);
            }
            if (! $confirmedDirectMove) {
                throw ValidationException::withMessages([
                    'confirmedDirectMove' => ['Konfirmasi pindah jadwal langsung wajib dicentang.'],
                ]);
            }

            $targetDate = Carbon::createFromFormat('Y-m-d', $date, 'Asia/Jakarta')->startOfDay();
            $segments = $this->buildSequentialSegments($targetDate, $time, (int) $booking->group_size);
            $this->lockSlotKeysForSegments($segments);
            $conflicts = $this->assertManualSegmentsUsable($booking, $segments, $allowOverbook);
            $current = $booking->slots->where('kind', BookingSlot::KIND_ACTIVE)->sortBy('slot_order')->values();
            if ($current->count() === count($segments)
                && $current->every(fn (BookingSlot $slot, int $index): bool => $slot->date->toDateString() === $segments[$index]['date']
                    && $slot->time === $segments[$index]['time']
                    && (int) $slot->group_size === $segments[$index]['group_size'])) {
                throw ValidationException::withMessages(['time' => ['Jadwal tujuan sama dengan jadwal booking saat ini.']]);
            }

            $affectedScheduleDates = $this->scheduleDatesForBooking($booking);
            $previousStatus = $booking->status;
            $first = $segments[0];
            $booking->date = $targetDate;
            $booking->date_label = $first['date_label'];
            $booking->time = $first['time'];
            $adminNote = $this->directMoveConfirmationNote($current->all(), $segments, $conflicts, $note);
            $booking->note = $this->appendAdminNote($booking->note, $adminNote);
            $booking->save();
            $this->persistBookingSlots($booking, $segments, true);

            $this->logAudit($actor, "Memindahkan langsung booking {$booking->code}", $booking, [
                'previous_status' => $previousStatus,
                'new_status' => $booking->status,
                'direct_move_confirmed' => $confirmedDirectMove,
                'overbook' => $conflicts !== [],
                'conflicts' => $conflicts,
                'note' => $adminNote,
            ], $request);
            $this->broadcastAfterCommit(fn () => BookingStatusChanged::dispatch($booking->fresh()->load('slots'), $previousStatus, 'direct-move'), $booking, $affectedScheduleDates);

            return $booking->fresh()->load('slots');
        });
    }

    private function transitionTo(
        Booking $booking,
        string $newStatus,
        ?User $actor,
        string $action,
        ?string $note = null,
        ?Request $request = null,
        ?string $documentationLink = null,
    ): Booking {
        try {
            return DB::transaction(function () use ($booking, $newStatus, $actor, $action, $note, $request, $documentationLink) {
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
                    $this->assertBookingCanBeAccepted($booking);
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
                    if ($documentationLink !== null) {
                        $booking->documentation_link = $documentationLink !== '' ? $documentationLink : null;
                    }
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
                $this->logAudit($actor, "{$verb} booking {$booking->code}", $booking, request: $request);

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
            'Accepted' => ['Completed', 'Reschedule', 'Rejected'],
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

    private function assertBookingCanBeAccepted(Booking $booking): void
    {
        if ($booking->status === 'Pending' && $booking->hasVisitStarted()) {
            throw ValidationException::withMessages([
                'status' => ['Jadwal kunjungan sudah terlewat. Tawarkan jadwal baru atau biarkan booking kedaluwarsa.'],
            ]);
        }

        if ($booking->status === 'Reschedule' && $booking->hasProposedVisitStarted()) {
            throw ValidationException::withMessages([
                'status' => ['Usulan jadwal kunjungan sudah terlewat. Tawarkan jadwal baru atau batalkan reschedule.'],
            ]);
        }
    }

    private function isPendingOlderThanTtl(Booking $booking, Carbon $now): bool
    {
        $pendingTtlHours = (int) config('booking.pending_ttl_hours', 48);

        return $pendingTtlHours > 0
            && $booking->submitted_at !== null
            && $booking->submitted_at->copy()->timezone('Asia/Jakarta')->lte($now->copy()->subHours($pendingTtlHours));
    }

    private const IDENTITY_LIMIT_MESSAGE = 'Identitas atau nomor WhatsApp ini sudah mencapai batas booking aktif. Tunggu proses selesai atau hubungi admin.';

    private function assertIdentityMayBook(string $nik, string $whatsapp, bool $lock = false): void
    {
        if (! $this->identityActiveBookingExceeded($nik, $whatsapp, $lock)) {
            return;
        }

        throw ValidationException::withMessages([
            'nik' => [self::IDENTITY_LIMIT_MESSAGE],
            'whatsapp' => [self::IDENTITY_LIMIT_MESSAGE],
        ]);
    }

    /**
     * Read-only check apakah identitas (NIK atau WhatsApp) sudah mencapai batas
     * booking aktif. Dipakai oleh precheck wizard maupun validasi submit akhir
     * supaya aturan bisnisnya tetap satu sumber.
     */
    public function identityActiveBookingExceeded(string $nik, string $whatsapp, bool $lock = false): bool
    {
        $limit = (int) config('booking.public_active_identity_limit', 2);
        if ($limit <= 0) {
            return false;
        }

        $nikHash = Booking::identityHash($nik);
        $normalizedWhatsapp = Booking::normalizeWhatsapp($whatsapp);

        $query = Booking::query()
            ->whereIn('status', Booking::ACTIVE_STATUSES)
            ->where(function ($identity) use ($nikHash, $normalizedWhatsapp) {
                $identity->where('nik_hash', $nikHash);

                if ($normalizedWhatsapp) {
                    $identity->orWhere('whatsapp_normalized', $normalizedWhatsapp);
                }
            });

        if ($lock) {
            $query->lockForUpdate();
        }

        return $query->count() >= $limit;
    }

    private function statusAfterStaleReschedule(Booking $booking, Carbon $now): string
    {
        $previous = in_array($booking->reschedule_previous_status, ['Pending', 'Accepted', 'Expired'], true)
            ? $booking->reschedule_previous_status
            : 'Accepted';

        if ($previous !== 'Expired' && ! $booking->hasVisitStarted($now)) {
            return $previous;
        }

        return 'Expired';
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
        bool $publicBooking = false,
    ): array {
        $segments = $this->buildSequentialSegments($date, $startTime, $groupSize);
        $selectedTimes = collect($segments)->pluck('time')->all();

        if ($lockBookings) {
            $this->lockSlotKeys($date->toDateString(), $selectedTimes);
        }

        if ($publicBooking) {
            if (! $this->schedule->publicSegmentsAreAvailable($segments, $lockBookings)) {
                $this->throwUnavailableSlot();
            }
        } else {
            $statuses = $this->schedule->slotStatusesFor($date, $selectedTimes, $lockBookings, $ignoreBookingId);
            if (collect($selectedTimes)->contains(fn (string $time): bool => ($statuses[$time] ?? 'Closed') !== 'Available')) {
                $this->throwUnavailableSlot();
            }
        }

        return $segments;
    }

    /**
     * @return array<int, array{slot_order:int,date:string,date_label:string,time:string,group_size:int}>
     */
    private function buildSequentialSegments(Carbon $date, string $startTime, int $groupSize): array
    {
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

        return collect($selectedTimes)->map(fn (string $slotTime, int $index): array => [
            'slot_order' => $index + 1,
            'date' => $date->toDateString(),
            'date_label' => $this->schedule->formatLongDate($date),
            'time' => $slotTime,
            'group_size' => $segmentSizes[$index],
        ])->all();
    }

    /**
     * @param  array<int, array{date:string,time:string,groupSize:int}>  $segments
     * @return array<int, array{slot_order:int,date:string,date_label:string,time:string,group_size:int}>
     */
    private function buildManualAdminSegments(array $segments): array
    {
        return collect($segments)
            ->groupBy(fn (array $segment): string => $segment['date'].'|'.$segment['time'])
            ->values()
            ->map(function ($group, int $index): array {
                $first = $group->first();
                $segmentDate = Carbon::createFromFormat('Y-m-d', $first['date'], 'Asia/Jakarta')->startOfDay();

                return [
                    'slot_order' => $index + 1,
                    'date' => $segmentDate->toDateString(),
                    'date_label' => $this->schedule->formatLongDate($segmentDate),
                    'time' => $first['time'],
                    'group_size' => $group->sum(fn (array $segment): int => (int) $segment['groupSize']),
                ];
            })
            ->sortBy([
                ['date', 'asc'],
                ['time', 'asc'],
            ])
            ->values()
            ->map(fn (array $segment, int $index): array => [
                ...$segment,
                'slot_order' => $index + 1,
            ])
            ->all();
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
                $startsAt = Carbon::createFromFormat('Y-m-d H.i', $dateKey.' '.$time, 'Asia/Jakarta');
                if ($startsAt->lte(now('Asia/Jakarta'))) {
                    throw ValidationException::withMessages([
                        'segments' => ["Slot {$dateKey} {$time} sudah lewat."],
                    ]);
                }
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
                'allowOverbook' => ['Slot yang dipilih sudah terisi. Centang izin overbook untuk menggabungkan rombongan.'],
            ]);
        }

        return $conflicts;
    }

    /**
     * @param  array<int, array{date:string,time:string,group_size:int}>  $segments
     */
    private function adminBookingConfirmationNote(array $data, array $conflicts, bool $hasDocument, array $segments): string
    {
        $parts = [
            'Konfirmasi admin: booking manual dibuat dari panel admin.',
            "Status awal {$data['status']}.",
            "Jadwal {$data['date']} {$data['time']} WIB.",
            "{$data['groupSize']} peserta.",
            $hasDocument ? 'Surat permohonan dilampirkan admin.' : 'Tanpa surat permohonan.',
        ];

        if (($data['status'] ?? null) === 'Accepted' && (bool) ($data['confirmedWithGuest'] ?? false)) {
            $parts[] = 'Jadwal sudah disepakati dengan tamu.';
        }

        if ($conflicts !== []) {
            $parts[] = 'Overbook manual disetujui operasional.';
        }

        if (isset($data['segments'])) {
            $parts[] = 'Pembagian kloter manual: '.collect($segments)
                ->map(fn (array $segment): string => "{$segment['time']} WIB ({$segment['group_size']} peserta)")
                ->join('; ').'.';
            if (collect($segments)->contains(fn (array $segment): bool => $segment['group_size'] > self::SLOT_CAPACITY)) {
                $parts[] = 'Ada kloter di atas kapasitas standar 80 peserta.';
            }
        }

        return implode(' ', $parts);
    }

    /**
     * @param  array<int, array{date:string,time:string,group_size:int}>  $segments
     * @param  array<int, array{date:string,time:string,status:string}>  $conflicts
     */
    private function segmentRiskConfirmationNote(int $oldGroupSize, int $targetGroupSize, array $segments, array $conflicts): string
    {
        $parts = ['Konfirmasi admin: perubahan kloter berisiko disetujui operasional.'];

        if ($oldGroupSize !== $targetGroupSize) {
            $parts[] = "Total peserta dikoreksi {$oldGroupSize} -> {$targetGroupSize}.";
        }

        if (collect($segments)->contains(fn (array $segment): bool => $segment['group_size'] > self::SLOT_CAPACITY)) {
            $parts[] = 'Ada kloter di atas kapasitas standar 80 peserta.';
        }

        if ($conflicts !== []) {
            $parts[] = 'Slot terisi digabung/di-overbook secara manual.';
        }

        $parts[] = 'Pembagian baru: '.collect($segments)
            ->map(fn (array $segment): string => "{$segment['time']} ({$segment['group_size']} peserta)")
            ->implode(', ').'.';

        return implode(' ', $parts);
    }

    /**
     * @param  array<int, BookingSlot>  $current
     * @param  array<int, array{date:string,date_label:string,time:string,group_size:int}>  $segments
     * @param  array<int, array{date:string,time:string,status:string}>  $conflicts
     */
    private function directMoveConfirmationNote(array $current, array $segments, array $conflicts, ?string $note = null): string
    {
        $from = collect($current)
            ->map(fn (BookingSlot $slot): string => $slot->date->toDateString().' '.$slot->time)
            ->implode(', ');
        $to = collect($segments)
            ->map(fn (array $segment): string => $segment['date'].' '.$segment['time'].' ('.$segment['group_size'].' peserta)')
            ->implode(', ');

        $parts = [
            'Konfirmasi admin: pindah jadwal langsung disetujui.',
            "Dari {$from} ke {$to}.",
            'Tamu sudah diberi tahu bila jadwal sebelumnya sudah disetujui.',
        ];

        if ($conflicts !== []) {
            $parts[] = 'Overbook manual disetujui operasional.';
        }

        if (trim((string) $note) !== '') {
            $parts[] = 'Catatan tambahan: '.trim((string) $note);
        }

        return implode(' ', $parts);
    }

    private function appendAdminNote(?string $existing, string $note): string
    {
        $entry = '['.now('Asia/Jakarta')->format('d-m-Y H.i').' WIB] '.trim($note);

        return trim((string) $existing) === '' ? $entry : rtrim($existing)."\n".$entry;
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

    private function logAudit(?User $actor, string $description, Booking $booking, array $payload = [], ?Request $request = null): void
    {
        AuditLogger::record($actor, $description, Booking::class, $booking->code, array_merge([
            'status' => $booking->status,
        ], $payload), $request);
    }
}
