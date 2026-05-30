<?php

namespace App\Services;

use App\Events\BookingCreated;
use App\Events\BookingStatusChanged;
use App\Models\Booking;
use App\Models\BookingSlot;
use App\Models\User;
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
        $documentPath = null;

        try {
            return DB::transaction(function () use ($data, $document, $date, &$documentPath) {
                $segments = $this->buildSlotSegments($date, $data['time'], (int) $data['groupSize'], true);

                $code = $this->codes->next();
                $storedName = $code.'-'.Str::uuid().'.'.strtolower($document->getClientOriginalExtension());
                $documentPath = $document->storeAs(
                    'booking-letters',
                    $storedName,
                    'local',
                );

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

                BookingCreated::dispatch($booking->fresh()->load('slots'));

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

    public function complete(Booking $booking, ?User $actor): Booking
    {
        return $this->transitionTo($booking, 'Completed', $actor, 'complete');
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
                    ];
                }

                $booking = Booking::with('slots')
                    ->whereKey($booking->id)
                    ->lockForUpdate()
                    ->firstOrFail();

                if ($preparedProposal !== null) {
                    $booking->proposed_date = $preparedProposal['proposed_date'];
                    $booking->proposed_time = $preparedProposal['proposed_time'];
                    $booking->proposed_date_label = $preparedProposal['proposed_date_label'];
                    $booking->proposed_segments = $preparedProposal['proposed_segments'];
                    $booking->proposed_at = $preparedProposal['proposed_at'];
                }

                $previous = $booking->status;
                $this->assertValidTransition($previous, $newStatus);
                $replacementSegments = null;

                if ($newStatus === 'Accepted' && $booking->status === 'Reschedule' && $booking->proposed_date && $booking->proposed_time) {
                    $proposedDate = Carbon::parse($booking->proposed_date, 'Asia/Jakarta')->startOfDay();
                    $replacementSegments = $this->buildSlotSegments($proposedDate, $booking->proposed_time, $booking->group_size, true, $booking->id);

                    $booking->date = $proposedDate;
                    $booking->date_label = $this->schedule->formatLongDate($proposedDate);
                    $booking->time = $replacementSegments[0]['time'];
                    $booking->proposed_date = null;
                    $booking->proposed_time = null;
                    $booking->proposed_date_label = null;
                    $booking->proposed_segments = null;
                    $booking->proposed_at = null;
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
                }

                if ($newStatus === 'Completed') {
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

                BookingStatusChanged::dispatch($booking->fresh()->load('slots'), $previous, $action);

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
            default => [],
        };

        if (! in_array($newStatus, $allowed, true)) {
            throw ValidationException::withMessages([
                'status' => ["Status {$currentStatus} tidak dapat diubah menjadi {$newStatus}."],
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

        $segments = [];
        foreach ($selectedTimes as $index => $time) {
            $this->assertSlotAvailable($date, $time, $lockBookings, $ignoreBookingId);

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
        $booking->slots()->delete();

        foreach ($segments as $segment) {
            $booking->slots()->create([
                'slot_order' => $segment['slot_order'],
                'date' => $segment['date'],
                'date_label' => $segment['date_label'],
                'time' => $segment['time'],
                'group_size' => $segment['group_size'],
                'active_slot_key' => $active ? BookingSlot::slotKey($segment['date'], $segment['time']) : null,
            ]);
        }
    }

    private function syncBookingSlotKeys(Booking $booking): void
    {
        $active = $booking->isActiveForSchedule();
        $booking->slots()->get()->each(function (BookingSlot $slot) use ($active) {
            $slot->active_slot_key = $active ? BookingSlot::slotKey($slot->date, $slot->time) : null;
            $slot->save();
        });
    }

    private function assertSlotAvailable(Carbon $date, string $time, bool $lockBookings = false, ?int $ignoreBookingId = null): void
    {
        if ($this->schedule->slotStatusFor($date, $time, $lockBookings, $ignoreBookingId) !== 'Available') {
            $this->throwUnavailableSlot();
        }
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
            'time' => ["Rombongan ini membutuhkan {$requiredSlots} slot berurutan. Pilih jam mulai lain yang masih tersedia."],
        ]);
    }

    private function isUniqueSlotConflict(QueryException $exception): bool
    {
        $code = (string) $exception->getCode();
        $message = $exception->getMessage();

        return in_array($code, ['23000', '23505'], true)
            && str_contains($message, 'active_slot_key');
    }

    private function logAudit(?User $actor, string $description, Booking $booking): void
    {
        AuditLogger::record($actor, $description, Booking::class, $booking->code, [
            'status' => $booking->status,
        ]);
    }
}
