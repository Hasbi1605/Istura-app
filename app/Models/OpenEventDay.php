<?php

namespace App\Models;

use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class OpenEventDay extends Model
{
    protected $fillable = [
        'open_event_id',
        'date',
        'quota_override',
        'whatsapp_group_url',
        'opens_at',
        'is_open',
    ];

    protected $casts = [
        'date' => 'date',
        'quota_override' => 'integer',
        'opens_at' => 'datetime',
        'is_open' => 'boolean',
    ];

    public function event(): BelongsTo
    {
        return $this->belongsTo(OpenEvent::class, 'open_event_id');
    }

    public function registrations(): HasMany
    {
        return $this->hasMany(OpenRegistration::class, 'assigned_event_day_id');
    }

    /**
     * Effective quota for this day (override falls back to event default).
     */
    public function effectiveQuota(?OpenEvent $event = null): int
    {
        if ($this->quota_override !== null) {
            return (int) $this->quota_override;
        }

        $event = $event ?? $this->event;

        return (int) ($event?->per_day_quota ?? 0);
    }

    /**
     * Whether this day currently accepts registrations (open flag + opens_at gate).
     */
    public function acceptsRegistrations(?CarbonInterface $now = null): bool
    {
        if (! $this->is_open) {
            return false;
        }

        $now = $now ?? now('Asia/Jakarta');

        if ($this->opens_at && $now->lt($this->opens_at)) {
            return false;
        }

        return true;
    }
}
