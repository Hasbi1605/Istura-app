<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ScheduleOverride extends Model
{
    public const STATUSES = ['Available', 'Held', 'Booked', 'Closed', 'Reschedule Hold'];

    protected $guarded = [];

    protected $casts = [
        'date' => 'date',
        'custom' => 'boolean',
    ];
}
