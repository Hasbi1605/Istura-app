<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SiteSetting extends Model
{
    protected $guarded = [];

    protected $casts = [
        'value' => 'array',
    ];

    /**
     * Fetch a single setting's value, falling back to the provided default
     * when the row does not exist yet.
     */
    public static function read(string $key, array $default = []): array
    {
        $setting = static::where('key', $key)->first();

        return $setting?->value ?? $default;
    }

    public static function write(string $key, array $value): self
    {
        return static::updateOrCreate(['key' => $key], ['value' => $value]);
    }
}
