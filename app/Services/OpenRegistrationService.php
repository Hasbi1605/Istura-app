<?php

namespace App\Services;

use App\Events\OpenQuotaUpdated;
use App\Models\Booking;
use App\Models\OpenEvent;
use App\Models\OpenEventDay;
use App\Models\OpenRegistration;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Centralizes Istura Open registration mechanics: atomic quota enforcement,
 * identity de-duplication, self/admin cancel, admin move, and quota reads.
 *
 * Fully isolated from BookingService / ScheduleService — operates only on the
 * open_* tables so the rombongan flow stays untouched.
 */
class OpenRegistrationService
{
    public function __construct(
        private readonly OpenRegistrationCodeGenerator $codes,
    ) {}

    public function activeEvent(): ?OpenEvent
    {
        return OpenEvent::where('is_active', true)
            ->with('days')
            ->latest('id')
            ->first();
    }

    /**
     * Per-day quota usage summary for an event (no WhatsApp links exposed).
     *
     * @return array<int, array{dayId:int,date:string,quota:int,used:int,remaining:int,isOpen:bool,opensAt:?string}>
     */
    public function quotaSummary(OpenEvent $event): array
    {
        $used = OpenRegistration::query()
            ->where('open_event_id', $event->id)
            ->whereIn('status', OpenRegistration::ACTIVE_STATUSES)
            ->whereNotNull('assigned_event_day_id')
            ->groupBy('assigned_event_day_id')
            ->selectRaw('assigned_event_day_id, COALESCE(SUM(headcount),0) as total')
            ->pluck('total', 'assigned_event_day_id');

        $now = now('Asia/Jakarta');

        return $event->days->map(function (OpenEventDay $day) use ($event, $used, $now) {
            $quota = $day->effectiveQuota($event);
            $usedCount = (int) ($used[$day->id] ?? 0);

            return [
                'dayId' => $day->id,
                'date' => $day->date?->toDateString(),
                'quota' => $quota,
                'used' => $usedCount,
                'remaining' => max(0, $quota - $usedCount),
                'isOpen' => $day->acceptsRegistrations($now),
                'opensAt' => $day->opens_at?->toIso8601String(),
            ];
        })->all();
    }

    /**
     * Read-only identity + availability check used by the public precheck step.
     *
     * @return array{identityAvailable:bool,alreadyRegistered:bool}
     */
    public function precheck(OpenEvent $event, string $nik, string $whatsapp): array
    {
        $existing = $this->findActiveByIdentity($event, $nik, $whatsapp);

        return [
            'identityAvailable' => $existing === null,
            'alreadyRegistered' => $existing !== null,
        ];
    }

    /**
     * Create a registration atomically. Returns the saved registration with its
     * day loaded so the caller can hand back the WhatsApp group link.
     *
     * @param  array{contactName:string,nik:string,whatsapp:string,members?:array<int,string>,assignedDayId:int}  $data
     */
    public function register(OpenEvent $event, array $data, ?Request $request = null): OpenRegistration
    {
        $members = array_values(array_filter(
            array_map(fn ($name) => trim((string) $name), $data['members'] ?? []),
            fn (string $name) => $name !== '',
        ));

        if (count($members) > (int) $event->max_addons) {
            throw ValidationException::withMessages([
                'members' => ["Maksimal {$event->max_addons} anggota tambahan."],
            ]);
        }

        $headcount = 1 + count($members);
        $code = $this->codes->next();

        $registration = DB::transaction(function () use ($event, $data, $members, $headcount, $code) {
            // Serialize all registrations for this event so quota + identity
            // uniqueness are race-free across days (locks one counter row).
            $lockedEvent = OpenEvent::whereKey($event->id)->lockForUpdate()->firstOrFail();

            if (! $lockedEvent->is_active) {
                throw ValidationException::withMessages([
                    'event' => ['Pendaftaran Istura Open sedang tidak aktif.'],
                ]);
            }

            if (! $lockedEvent->registrationWindowOpen()) {
                throw ValidationException::withMessages([
                    'event' => ['Pendaftaran belum dibuka atau sudah ditutup.'],
                ]);
            }

            $day = OpenEventDay::where('open_event_id', $lockedEvent->id)
                ->whereKey($data['assignedDayId'])
                ->first();

            if (! $day) {
                throw ValidationException::withMessages([
                    'assignedDayId' => ['Hari yang dipilih tidak tersedia.'],
                ]);
            }

            if (! $day->acceptsRegistrations()) {
                throw ValidationException::withMessages([
                    'assignedDayId' => ['Hari ini belum dibuka untuk pendaftaran.'],
                ]);
            }

            $this->assertIdentityFree($lockedEvent, $data['nik'], $data['whatsapp']);

            $quota = $day->effectiveQuota($lockedEvent);
            $used = (int) OpenRegistration::where('open_event_id', $lockedEvent->id)
                ->where('assigned_event_day_id', $day->id)
                ->whereIn('status', OpenRegistration::ACTIVE_STATUSES)
                ->sum('headcount');

            if ($used + $headcount > $quota) {
                throw ValidationException::withMessages([
                    'assignedDayId' => ['Hari ini sudah penuh, silakan pilih hari lain.'],
                ]);
            }

            $registration = new OpenRegistration;
            $registration->code = $code;
            $registration->open_event_id = $lockedEvent->id;
            $registration->assigned_event_day_id = $day->id;
            $registration->contact_name = $data['contactName'];
            $registration->nik = $data['nik'];
            $registration->whatsapp = $data['whatsapp'];
            $registration->city = $data['city'] ?? null;
            $registration->members = $members;
            $registration->headcount = $headcount;
            $registration->status = 'Registered';
            $registration->registered_at = now();
            $registration->save();

            return $registration;
        });

        $this->afterQuotaChange($event, "Pendaftaran Istura Open {$registration->code}", $registration, $request);

        return $registration->fresh(['day', 'event']);
    }

    /**
     * Public lookup that requires BOTH the NIK and the WhatsApp number used at
     * registration. Knowing only a NIK must not reveal a registration or leak
     * the private WhatsApp group link.
     */
    public function lookupByIdentity(OpenEvent $event, string $nik, string $whatsapp): ?OpenRegistration
    {
        $normalizedWhatsapp = Booking::normalizeWhatsapp($whatsapp);

        if (! $normalizedWhatsapp) {
            return null;
        }

        return OpenRegistration::where('open_event_id', $event->id)
            ->whereIn('status', OpenRegistration::ACTIVE_STATUSES)
            ->where('nik_hash', Booking::identityHash($nik))
            ->where('whatsapp_normalized', $normalizedWhatsapp)
            ->with('day')
            ->latest('id')
            ->first();
    }

    public function findByCode(OpenEvent $event, string $code): ?OpenRegistration
    {
        return OpenRegistration::where('open_event_id', $event->id)
            ->where('code', $code)
            ->with('day')
            ->first();
    }

    public function cancel(OpenRegistration $registration, ?User $actor = null, ?Request $request = null): OpenRegistration
    {
        $event = $registration->event;

        $registration = DB::transaction(function () use ($registration) {
            $locked = OpenRegistration::whereKey($registration->id)->lockForUpdate()->firstOrFail();

            if (! $locked->isActive()) {
                throw ValidationException::withMessages([
                    'status' => ['Pendaftaran ini sudah tidak aktif.'],
                ]);
            }

            $locked->status = 'Cancelled';
            $locked->cancelled_at = now();
            $locked->save();

            return $locked;
        });

        $actorLabel = $actor ? "oleh {$actor->name}" : 'oleh pendaftar';
        $this->afterQuotaChange($event, "Pembatalan pendaftaran Istura Open {$registration->code} {$actorLabel}", $registration, $request, $actor);

        return $registration->fresh(['day', 'event']);
    }

    public function move(
        OpenRegistration $registration,
        OpenEventDay $targetDay,
        ?User $actor,
        bool $allowOverbook = false,
        ?string $note = null,
        ?Request $request = null,
    ): OpenRegistration {
        $event = $registration->event;

        $registration = DB::transaction(function () use ($registration, $targetDay, $allowOverbook, $note) {
            OpenEvent::whereKey($registration->open_event_id)->lockForUpdate()->firstOrFail();
            $locked = OpenRegistration::whereKey($registration->id)->lockForUpdate()->firstOrFail();

            if (! $locked->isActive()) {
                throw ValidationException::withMessages([
                    'status' => ['Hanya pendaftaran aktif yang dapat dipindahkan.'],
                ]);
            }

            $day = OpenEventDay::where('open_event_id', $locked->open_event_id)
                ->whereKey($targetDay->id)
                ->firstOrFail();

            if ($day->id === $locked->assigned_event_day_id) {
                return $locked;
            }

            $quota = $day->effectiveQuota();
            $used = (int) OpenRegistration::where('open_event_id', $locked->open_event_id)
                ->where('assigned_event_day_id', $day->id)
                ->whereIn('status', OpenRegistration::ACTIVE_STATUSES)
                ->sum('headcount');

            $exceedsQuota = $used + $locked->headcount > $quota;

            if ($exceedsQuota && ! $allowOverbook) {
                throw ValidationException::withMessages([
                    'dayId' => ['Hari tujuan sudah penuh. Centang izin overbook untuk tetap memindahkan.'],
                ]);
            }

            if ($exceedsQuota && trim((string) $note) === '') {
                throw ValidationException::withMessages([
                    'note' => ['Catatan wajib diisi saat overbook.'],
                ]);
            }

            $locked->assigned_event_day_id = $day->id;
            $locked->save();

            return $locked;
        });

        $this->afterQuotaChange($event, "Memindahkan pendaftaran Istura Open {$registration->code} ke hari lain", $registration, $request, $actor);

        return $registration->fresh(['day', 'event']);
    }

    private function assertIdentityFree(OpenEvent $event, string $nik, string $whatsapp): void
    {
        $existing = $this->findActiveByIdentity($event, $nik, $whatsapp);

        if ($existing !== null) {
            throw ValidationException::withMessages([
                'nik' => ['NIK atau nomor WhatsApp ini sudah terdaftar di event ini.'],
                'whatsapp' => ['NIK atau nomor WhatsApp ini sudah terdaftar di event ini.'],
            ]);
        }
    }

    private function findActiveByIdentity(OpenEvent $event, string $nik, string $whatsapp): ?OpenRegistration
    {
        $nikHash = Booking::identityHash($nik);
        $normalizedWhatsapp = Booking::normalizeWhatsapp($whatsapp);

        return OpenRegistration::where('open_event_id', $event->id)
            ->whereIn('status', OpenRegistration::ACTIVE_STATUSES)
            ->where(function ($query) use ($nikHash, $normalizedWhatsapp) {
                $query->where('nik_hash', $nikHash);

                if ($normalizedWhatsapp) {
                    $query->orWhere('whatsapp_normalized', $normalizedWhatsapp);
                }
            })
            ->with('day')
            ->first();
    }

    private function afterQuotaChange(
        OpenEvent $event,
        string $auditAction,
        OpenRegistration $registration,
        ?Request $request,
        ?User $actor = null,
    ): void {
        AuditLogger::record(
            $actor,
            $auditAction,
            'open_registration',
            $registration->code,
            ['eventSlug' => $event->slug, 'dayId' => $registration->assigned_event_day_id],
            $request,
        );

        DB::afterCommit(function () use ($event) {
            rescue(fn () => OpenQuotaUpdated::dispatch($event->slug));
        });
    }
}
