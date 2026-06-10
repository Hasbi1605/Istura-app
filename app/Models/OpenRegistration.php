<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Crypt;

class OpenRegistration extends Model
{
    public const STATUSES = ['Registered', 'Confirmed', 'Cancelled', 'Waitlisted'];

    /** Statuses that consume quota and the active NIK/WhatsApp slot. */
    public const ACTIVE_STATUSES = ['Registered', 'Confirmed'];

    protected $fillable = [
        'contact_name',
        'nik',
        'whatsapp',
        'members',
        'headcount',
    ];

    protected $casts = [
        'members' => 'array',
        'headcount' => 'integer',
        'registered_at' => 'datetime',
        'cancelled_at' => 'datetime',
    ];

    public function event(): BelongsTo
    {
        return $this->belongsTo(OpenEvent::class, 'open_event_id');
    }

    public function day(): BelongsTo
    {
        return $this->belongsTo(OpenEventDay::class, 'assigned_event_day_id');
    }

    /**
     * Encrypt NIK on write, decrypt on read. Reuses Booking helpers so the
     * encryption + hashing scheme stays identical across the app.
     */
    protected function nik(): Attribute
    {
        return Attribute::make(
            get: fn () => $this->nik_encrypted ? Crypt::decryptString($this->nik_encrypted) : null,
            set: fn (?string $value) => [
                'nik_encrypted' => $value ? Crypt::encryptString($value) : null,
                'nik_masked' => $value ? substr($value, 0, 4).str_repeat('*', max(0, strlen($value) - 8)).substr($value, -4) : null,
                'nik_hash' => $value ? Booking::identityHash($value) : null,
            ],
        );
    }

    protected function whatsapp(): Attribute
    {
        return Attribute::make(
            set: fn (?string $value) => [
                'whatsapp' => $value,
                'whatsapp_normalized' => Booking::normalizeWhatsapp($value),
            ],
        );
    }

    public function isActive(): bool
    {
        return in_array($this->status, self::ACTIVE_STATUSES, true);
    }
}
