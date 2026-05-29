<?php

namespace App\Services;

use App\Events\BookingCreated;
use App\Events\BookingStatusChanged;
use App\Models\AuditLog;
use App\Models\Booking;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;

/**
 * Centralizes booking lifecycle: create from public form, status transitions,
 * audit-log writes, and broadcast events. Controllers stay thin.
 */
class BookingService
{
    public function __construct(
        private readonly BookingCodeGenerator $codes,
        private readonly ScheduleService $schedule,
    ) {}

    public function createFromPublic(array $data, UploadedFile $document): Booking
    {
        $date = Carbon::createFromFormat('Y-m-d', $data['date']);

        return DB::transaction(function () use ($data, $document, $date) {
            $code = $this->codes->next();
            $documentPath = $document->storeAs(
                'booking-letters',
                $code.'-'.$document->getClientOriginalName(),
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
            $booking->time = $data['time'];
            $booking->status = 'Pending';
            $booking->document_path = $documentPath;
            $booking->document_original_name = $document->getClientOriginalName();
            $booking->feedback_token = $this->codes->token();
            $booking->submitted_at = now();
            $booking->save();

            $this->logAudit(null, "Booking baru {$booking->code} dari {$booking->institution}", $booking);

            BookingCreated::dispatch($booking->fresh());

            return $booking->fresh();
        });
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
        $booking->completed_at = now();

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
        $booking->proposed_date_label = $this->schedule->formatLongDate(Carbon::createFromFormat('Y-m-d', $proposedDate));
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
        return DB::transaction(function () use ($booking, $newStatus, $actor, $action, $note) {
            $previous = $booking->status;
            $booking->status = $newStatus;
            if ($note !== null) {
                $booking->note = $note;
            }
            $booking->save();

            $verb = match ($action) {
                'accept' => 'Menyetujui',
                'reject' => 'Menolak',
                'complete' => 'Menandai selesai',
                'reschedule' => 'Menjadwalkan ulang',
                default => 'Mengubah',
            };
            $this->logAudit($actor, "{$verb} booking {$booking->code}", $booking);

            BookingStatusChanged::dispatch($booking->fresh(), $previous, $action);

            return $booking->fresh();
        });
    }

    private function logAudit(?User $actor, string $description, Booking $booking): void
    {
        AuditLog::create([
            'actor_id' => $actor?->id,
            'actor_name' => $actor?->name ?? 'Sistem',
            'action' => $description,
            'target_type' => Booking::class,
            'target_id' => $booking->code,
            'payload' => ['status' => $booking->status],
            'created_at' => now(),
        ]);
    }
}
