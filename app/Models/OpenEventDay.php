<?php

namespace App\Models;

use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class OpenEventDay extends Model
{
    /** Days after the visit date that the feedback link stays open. */
    public const FEEDBACK_WINDOW_DAYS = 14;

    protected $fillable = [
        'open_event_id',
        'date',
        'quota_override',
        'whatsapp_group_url',
        'feedback_token',
        'opens_at',
        'is_open',
    ];

    protected $casts = [
        'date' => 'date',
        'quota_override' => 'integer',
        'opens_at' => 'datetime',
        'is_open' => 'boolean',
    ];

    protected static function booted(): void
    {
        // Every day gets a shared feedback link token (one link per WhatsApp
        // group) so admins can distribute it as soon as the day exists.
        static::creating(function (OpenEventDay $day) {
            if (blank($day->feedback_token)) {
                $day->feedback_token = self::generateFeedbackToken();
            }
        });
    }

    public static function generateFeedbackToken(): string
    {
        return 'of_'.rtrim(strtr(base64_encode(random_bytes(20)), '+/', '-_'), '=');
    }

    public function event(): BelongsTo
    {
        return $this->belongsTo(OpenEvent::class, 'open_event_id');
    }

    public function registrations(): HasMany
    {
        return $this->hasMany(OpenRegistration::class, 'assigned_event_day_id');
    }

    public function feedbacks(): HasMany
    {
        return $this->hasMany(OpenFeedback::class, 'open_event_day_id');
    }

    /**
     * Feedback window: open from the visit date until FEEDBACK_WINDOW_DAYS after.
     * Returns one of: not_open_yet, available, closed.
     */
    public function feedbackAccessStatus(?CarbonInterface $now = null): string
    {
        if (! $this->date) {
            return 'closed';
        }

        $now = $now ?? now('Asia/Jakarta');
        $opensAt = $this->date->copy()->startOfDay();
        $closesAt = $this->date->copy()->addDays(self::FEEDBACK_WINDOW_DAYS)->endOfDay();

        if ($now->lt($opensAt)) {
            return 'not_open_yet';
        }

        if ($now->gt($closesAt)) {
            return 'closed';
        }

        return 'available';
    }

    public function feedbackClosesAt(): ?CarbonInterface
    {
        return $this->date?->copy()->addDays(self::FEEDBACK_WINDOW_DAYS)->endOfDay();
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
