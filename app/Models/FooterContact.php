<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class FooterContact extends Model
{
    public const ICONS = ['instagram', 'youtube', 'whatsapp', 'email', 'phone'];

    protected $fillable = [
        'slug',
        'label',
        'value',
        'icon',
        'href',
        'sort_order',
    ];

    protected $casts = [
        'sort_order' => 'integer',
    ];
}
