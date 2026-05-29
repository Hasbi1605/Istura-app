<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Support\Facades\Crypt;

class Booking extends Model
{
    public const STATUSES = ['Pending', 'Accepted', 'Rejected', 'Reschedule', 'Completed'];

    protected $guarded = [];

    protected $casts = [
        'date' => 'date',
        'submitted_at' => 'datetime',
        'completed_at' => 'datetime',
        'proposed_date' => 'date',
        'proposed_at' => 'datetime',
        'group_size' => 'integer',
    ];

    public function feedback(): HasOne
    {
        return $this->hasOne(Feedback::class);
    }

    /**
     * Encrypt NIK on write, decrypt on read.
     */
    protected function nik(): Attribute
    {
        return Attribute::make(
            get: fn () => $this->nik_encrypted ? Crypt::decryptString($this->nik_encrypted) : null,
            set: fn (?string $value) => [
                'nik_encrypted' => $value ? Crypt::encryptString($value) : null,
                'nik_masked' => $value ? substr($value, 0, 4).str_repeat('*', max(0, strlen($value) - 8)).substr($value, -4) : null,
            ],
        );
    }

    public function scopeForRange($query, ?string $from, ?string $to)
    {
        return $query
            ->when($from, fn ($q) => $q->whereDate('date', '>=', $from))
            ->when($to, fn ($q) => $q->whereDate('date', '<=', $to));
    }
}
