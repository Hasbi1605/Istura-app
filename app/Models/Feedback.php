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
        'rating',
        'booking_ease',
        'service',
        'recommend',
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
        'rating' => 'integer',
        'booking_ease' => 'integer',
        'service' => 'integer',
        'recommend' => 'integer',
    ];

    public function booking(): BelongsTo
    {
        return $this->belongsTo(Booking::class);
    }
}
