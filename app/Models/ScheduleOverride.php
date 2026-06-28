<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ScheduleOverride extends Model
{
    public const STATUSES = ['Available', 'Held', 'Booked', 'Closed', 'Reschedule Hold'];

    protected $fillable = [
        'date',
        'time',
        'status',
        'custom',
        'public_early_opened_at',
        'note',
        'short_notice_mode',
        'short_notice_closes_at',
        'short_notice_capacity',
    ];

    protected $casts = [
        'date' => 'date',
        'custom' => 'boolean',
        'public_early_opened_at' => 'datetime',
        'short_notice_closes_at' => 'datetime',
        'short_notice_capacity' => 'integer',
    ];
}
