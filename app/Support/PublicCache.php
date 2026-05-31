<?php

namespace App\Support;

use Illuminate\Support\Facades\Cache;

class PublicCache
{
    private const CMS_TTL = 3600;

    private const SCHEDULE_TTL = 300;

    public const CMS_BROWSER_TTL = 300;

    public const SCHEDULE_BROWSER_TTL = 60;

    public const BOOTSTRAP_BROWSER_TTL = 60;

    public const STALE_WHILE_REVALIDATE = 300;

    /**
     * Public API payloads do not contain visitor-specific data. Let browsers
     * and the CDN reuse them briefly while the server-side cache stays longer.
     */
    public static function publicHeaders(int $maxAge): array
    {
        return [
            'Cache-Control' => sprintf(
                'public, max-age=%d, s-maxage=%d, stale-while-revalidate=%d',
                $maxAge,
                $maxAge,
                self::STALE_WHILE_REVALIDATE,
            ),
        ];
    }

    public static function rememberCms(string $key, callable $resolver): mixed
    {
        return Cache::remember("public:cms:{$key}", self::CMS_TTL, $resolver);
    }

    public static function forgetCms(string ...$keys): void
    {
        foreach ($keys as $key) {
            Cache::forget("public:cms:{$key}");
        }
    }

    public static function rememberSchedule(string $from, string $to, callable $resolver): mixed
    {
        $version = Cache::get('public:schedule:version', 1);
        $key = "public:schedule:v{$version}:{$from}:{$to}";

        self::trackScheduleKey($key);

        return Cache::remember($key, self::SCHEDULE_TTL, $resolver);
    }

    public static function bumpScheduleVersion(): void
    {
        foreach (Cache::get('public:schedule:keys', []) as $key) {
            Cache::forget($key);
        }

        Cache::forget('public:schedule:keys');

        $version = (int) Cache::get('public:schedule:version', 1);

        Cache::forever('public:schedule:version', $version + 1);
    }

    private static function trackScheduleKey(string $key): void
    {
        $keys = Cache::get('public:schedule:keys', []);
        if (in_array($key, $keys, true)) {
            return;
        }

        $keys[] = $key;
        Cache::forever('public:schedule:keys', array_slice($keys, -100));
    }
}
