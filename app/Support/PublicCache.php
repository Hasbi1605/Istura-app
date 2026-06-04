<?php

namespace App\Support;

use Illuminate\Support\Facades\Cache;

class PublicCache
{
    private const SCHEDULE_VERSION_KEY = 'public:schedule:version';

    private const CMS_TTL = 3600;

    private const SCHEDULE_TTL = 300;

    public const CMS_BROWSER_TTL = 300;

    public const SCHEDULE_BROWSER_TTL = 0;

    public const BOOTSTRAP_BROWSER_TTL = 0;

    public const STALE_WHILE_REVALIDATE = 300;

    /**
     * Public API payloads do not contain visitor-specific data. Let browsers
     * and the CDN reuse them briefly while the server-side cache stays longer.
     */
    public static function publicHeaders(int $maxAge): array
    {
        if ($maxAge <= 0) {
            return [
                'Cache-Control' => 'public, no-cache, max-age=0, s-maxage=0, must-revalidate',
            ];
        }

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
        $version = Cache::get(self::SCHEDULE_VERSION_KEY, 1);
        $key = "public:schedule:v{$version}:{$from}:{$to}";

        return Cache::remember($key, self::SCHEDULE_TTL, $resolver);
    }

    public static function bumpScheduleVersion(): void
    {
        self::incrementScheduleVersion();
    }

    private static function incrementScheduleVersion(): void
    {
        Cache::add(self::SCHEDULE_VERSION_KEY, 1, now()->addYears(10));

        if (Cache::increment(self::SCHEDULE_VERSION_KEY) === false) {
            $version = (int) Cache::get(self::SCHEDULE_VERSION_KEY, 1);
            Cache::forever(self::SCHEDULE_VERSION_KEY, $version + 1);
        }
    }
}
