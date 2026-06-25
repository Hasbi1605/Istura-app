<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Crypt;

class OpenFeedback extends Model
{
    protected $table = 'open_feedbacks';

    protected $fillable = [
        'open_event_id',
        'open_event_day_id',
        'nik',
        'whatsapp',
        'visitor_name',
        'gender',
        'age',
        'origin',
        'rating',
        'booking_ease',
        'service',
        'guide_quality',
        'facility_comfort',
        'recommend',
        'visited_before',
        'discovery_source',
        'discovery_source_other',
        'highlights',
        'improvements',
        'comment',
        'allow_publish',
        'submitted_at',
    ];

    protected $casts = [
        'highlights' => 'array',
        'improvements' => 'array',
        'allow_publish' => 'boolean',
        'submitted_at' => 'datetime',
        'age' => 'integer',
        'rating' => 'integer',
        'booking_ease' => 'integer',
        'service' => 'integer',
        'guide_quality' => 'integer',
        'facility_comfort' => 'integer',
        'recommend' => 'integer',
        'visited_before' => 'boolean',
    ];

    public function event(): BelongsTo
    {
        return $this->belongsTo(OpenEvent::class, 'open_event_id');
    }

    public function day(): BelongsTo
    {
        return $this->belongsTo(OpenEventDay::class, 'open_event_day_id');
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
}
