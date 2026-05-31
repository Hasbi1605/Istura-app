<?php

namespace App\Models;

use DateTimeInterface;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BookingSlot extends Model
{
    public const KIND_ACTIVE = 'active';

    public const KIND_PROPOSED = 'proposed';

    protected $fillable = [
        'booking_id',
        'kind',
        'slot_order',
        'date',
        'date_label',
        'time',
        'group_size',
        'active_slot_key',
    ];

    protected $casts = [
        'date' => 'date',
        'slot_order' => 'integer',
        'group_size' => 'integer',
    ];

    public function booking(): BelongsTo
    {
        return $this->belongsTo(Booking::class);
    }

    public static function slotKey(DateTimeInterface|string|null $date, ?string $time): ?string
    {
        if (! $date || ! $time) {
            return null;
        }

        $dateKey = $date instanceof DateTimeInterface ? $date->format('Y-m-d') : $date;

        return $dateKey.'|'.$time;
    }
}
