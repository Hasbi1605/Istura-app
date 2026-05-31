<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    private const REPLACEMENTS = [
        '/assets/penyambutan.jpg' => '/assets/penyambutan.webp',
        '/assets/cerita-sejarah-gedung-agung.jpg' => '/assets/cerita-sejarah-gedung-agung.webp',
        '/assets/museum.jpg' => '/assets/museum.webp',
        '/assets/perpustakaan.jpg' => '/assets/perpustakaan.webp',
        '/assets/gedung-agung-white.png' => '/assets/gedung-agung-white.webp',
        '/assets/gedung-agung-gold.png' => '/assets/gedung-agung-gold.webp',
    ];

    public function up(): void
    {
        $this->replaceUrls(self::REPLACEMENTS);
    }

    public function down(): void
    {
        $this->replaceUrls(array_flip(self::REPLACEMENTS));
    }

    private function replaceUrls(array $replacements): void
    {
        DB::table('site_settings')
            ->whereIn('key', ['site_content', 'letter', 'hero'])
            ->orderBy('id')
            ->get(['id', 'key', 'value'])
            ->each(function ($setting) use ($replacements) {
                $value = json_decode((string) $setting->value, true);
                if (! is_array($value)) {
                    return;
                }

                $next = $this->replaceInValue($value, $replacements);
                if ($next === $value) {
                    return;
                }

                DB::table('site_settings')
                    ->where('id', $setting->id)
                    ->update([
                        'value' => json_encode($next, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
                        'updated_at' => now(),
                    ]);

                Cache::forget("site-setting:{$setting->key}");
            });

        Cache::forget('public:cms:site-content');
        Cache::forget('public:cms:letter');
        Cache::forget('public:cms:hero');
    }

    private function replaceInValue(mixed $value, array $replacements): mixed
    {
        if (is_string($value)) {
            return $replacements[$value] ?? $value;
        }

        if (! is_array($value)) {
            return $value;
        }

        foreach ($value as $key => $item) {
            $value[$key] = $this->replaceInValue($item, $replacements);
        }

        return $value;
    }
};
