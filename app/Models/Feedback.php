<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Feedback extends Model
{
    protected $table = 'feedbacks';

    protected $fillable = [
        'booking_id',
        'code',
        'visitor_name',
        'gender',
        'age',
        'origin',
        'rating',
        'booking_ease',
        'service',
        'guide_quality',
        'facility_comfort',
        'recommend',
        'visited_before',
        'discovery_source',
        'discovery_source_other',
        'highlights',
        'improvements',
        'comment',
        'allow_publish',
        'submitted_at',
    ];

    protected $casts = [
        'highlights' => 'array',
        'improvements' => 'array',
        'allow_publish' => 'boolean',
        'submitted_at' => 'datetime',
        'age' => 'integer',
        'rating' => 'integer',
        'booking_ease' => 'integer',
        'service' => 'integer',
        'guide_quality' => 'integer',
        'facility_comfort' => 'integer',
        'recommend' => 'integer',
        'visited_before' => 'boolean',
    ];

    public function booking(): BelongsTo
    {
        return $this->belongsTo(Booking::class);
    }
}
