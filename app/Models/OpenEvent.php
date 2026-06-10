<?php

namespace App\Models;

use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

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
        'whatsapp_template',
        'is_active',
    ];

    protected $casts = [
        'start_date' => 'date',
        'end_date' => 'date',
        'per_day_quota' => 'integer',
        'max_addons' => 'integer',
        'registration_opens_at' => 'datetime',
        'registration_closes_at' => 'datetime',
        'is_active' => 'boolean',
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
}
