<?php

namespace App\Models;

use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\Storage;

class OpenEvent extends Model
{
    public const ASSIGNMENT_MODES = ['self_select', 'pool'];

    public const RELEASE_MODES = ['simultaneous', 'sequential'];

    protected $fillable = [
        'name',
        'slug',
        'start_date',
        'end_date',
        'per_day_quota',
        'max_addons',
        'assignment_mode',
        'release_mode',
        'registration_opens_at',
        'registration_closes_at',
        'agreement_text',
        'poster_path',
        'promo_subtitle',
        'banner_text',
        'whatsapp_template',
        'is_active',
        'archived_at',
    ];

    protected $casts = [
        'start_date' => 'date',
        'end_date' => 'date',
        'per_day_quota' => 'integer',
        'max_addons' => 'integer',
        'registration_opens_at' => 'datetime',
        'registration_closes_at' => 'datetime',
        'is_active' => 'boolean',
        'archived_at' => 'datetime',
    ];

    public function days(): HasMany
    {
        return $this->hasMany(OpenEventDay::class)->orderBy('date');
    }

    public function registrations(): HasMany
    {
        return $this->hasMany(OpenRegistration::class);
    }

    /**
     * Public URL for the optional poster/flyer, or null when none uploaded.
     */
    public function posterUrl(): ?string
    {
        return $this->poster_path ? Storage::disk('public')->url($this->poster_path) : null;
    }

    /**
     * Whether public registration is currently within the configured window.
     */
    public function registrationWindowOpen(?CarbonInterface $now = null): bool
    {
        $now = $now ?? now('Asia/Jakarta');

        if ($this->registration_opens_at && $now->lt($this->registration_opens_at)) {
            return false;
        }

        if ($this->registration_closes_at && $now->gt($this->registration_closes_at)) {
            return false;
        }

        return true;
    }

    public function isArchived(): bool
    {
        return $this->archived_at !== null;
    }

    public function isPast(?CarbonInterface $now = null): bool
    {
        if (! $this->end_date) {
            return false;
        }

        $now = $now ?? now('Asia/Jakarta');

        return $this->end_date->copy()->endOfDay()->lt($now);
    }

    public function acceptsPublicRegistrations(?CarbonInterface $now = null): bool
    {
        return $this->is_active
            && ! $this->isArchived()
            && ! $this->isPast($now)
            && $this->registrationWindowOpen($now);
    }
}
