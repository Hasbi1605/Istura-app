<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Faq extends Model
{
    protected $fillable = [
        'slug',
        'question',
        'answer',
        'category',
        'link_label',
        'link_href',
        'sort_order',
    ];

    protected $casts = [
        'sort_order' => 'integer',
    ];
}
