<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    private const UP_REPLACEMENTS = [
        '/assets/contoh-kop-surat.png' => '/assets/contoh-kop-surat.webp',
        '/assets/contoh-kop-surat.jpg' => '/assets/contoh-kop-surat.webp',
        '/assets/contoh-kop-surat.jpeg' => '/assets/contoh-kop-surat.webp',
        '/assets/hero-istana.jpg' => '/assets/hero-istana.webp',
        '/assets/hero-istana.jpeg' => '/assets/hero-istana.webp',
    ];

    private const DOWN_REPLACEMENTS = [
        '/assets/contoh-kop-surat.webp' => '/assets/contoh-kop-surat.png',
        '/assets/hero-istana.webp' => '/assets/hero-istana.jpeg',
    ];

    public function up(): void
    {
        $this->replaceUrls(self::UP_REPLACEMENTS);
    }

    public function down(): void
    {
        $this->replaceUrls(self::DOWN_REPLACEMENTS);
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
