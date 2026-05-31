<?php

namespace App\Models;

use DateTimeInterface;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Support\Facades\Crypt;

class Booking extends Model
{
    public const STATUSES = ['Pending', 'Accepted', 'Rejected', 'Reschedule', 'Completed'];

    public const ACTIVE_STATUSES = ['Pending', 'Accepted', 'Reschedule'];

    protected $fillable = [
        'contact_name',
        'nik',
        'whatsapp',
        'institution',
        'group_size',
        'date',
        'date_label',
        'time',
    ];

    protected $casts = [
        'date' => 'date',
        'submitted_at' => 'datetime',
        'completed_at' => 'datetime',
        'proposed_date' => 'date',
        'proposed_segments' => 'array',
        'proposed_at' => 'datetime',
        'group_size' => 'integer',
    ];

    protected static function booted(): void
    {
        static::saving(function (Booking $booking) {
            $booking->active_slot_key = $booking->isActiveForSchedule()
                ? $booking->slotKey($booking->date, $booking->time)
                : null;
        });
    }

    public function feedback(): HasOne
    {
        return $this->hasOne(Feedback::class);
    }

    public function slots(): HasMany
    {
        return $this->hasMany(BookingSlot::class)->orderBy('slot_order');
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

    public function isActiveForSchedule(): bool
    {
        return in_array($this->status, self::ACTIVE_STATUSES, true);
    }

    private function slotKey(DateTimeInterface|string|null $date, ?string $time): ?string
    {
        if (! $date || ! $time) {
            return null;
        }

        $dateKey = $date instanceof DateTimeInterface ? $date->format('Y-m-d') : $date;

        return $dateKey.'|'.$time;
    }
}
