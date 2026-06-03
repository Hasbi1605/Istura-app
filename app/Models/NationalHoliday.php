<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class NationalHoliday extends Model
{
    public const TYPE_NATIONAL_HOLIDAY = 'national_holiday';

    public const TYPE_COLLECTIVE_LEAVE = 'collective_leave';

    protected $fillable = [
        'date',
        'year',
        'name',
        'type',
        'tentative',
        'source',
        'source_url',
        'provider_updated_at',
        'synced_at',
        'checksum',
    ];

    protected $casts = [
        'date' => 'date',
        'tentative' => 'boolean',
        'provider_updated_at' => 'datetime',
        'synced_at' => 'datetime',
    ];
}
