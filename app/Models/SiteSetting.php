<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Cache;

class SiteSetting extends Model
{
    protected $fillable = [
        'key',
        'value',
    ];

    protected $casts = [
        'value' => 'array',
    ];

    /**
     * Fetch a single setting's value, falling back to the provided default
     * when the row does not exist yet.
     */
    public static function read(string $key, array $default = []): array
    {
        $value = Cache::remember("site-setting:{$key}", 3600, fn () => static::where('key', $key)->first()?->value);

        return $value ?? $default;
    }

    public static function write(string $key, array $value): self
    {
        Cache::forget("site-setting:{$key}");

        return static::updateOrCreate(['key' => $key], ['value' => $value]);
    }
}
