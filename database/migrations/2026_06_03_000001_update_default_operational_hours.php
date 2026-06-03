<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    private const OLD_HOURS = '08.00 - 14.00 WIB';

    private const NEW_HOURS = '08.00 - 11.00 & 13.00 - 14.00 WIB';

    private const FOOTER_HOURS = '08.00 - 11.00 & 13.00 - 14.00 WIB (istirahat 12.00 - 13.00)';

    private const REST_LABEL = 'Istirahat 12.00 - 13.00';

    public function up(): void
    {
        $this->updateSiteContent(function (array $content): array {
            $content = $this->replaceQuickInfoHours($content, self::OLD_HOURS, self::NEW_HOURS, true);

            if (($content['footer']['scheduleHours'] ?? null) === self::OLD_HOURS) {
                $content['footer']['scheduleHours'] = self::FOOTER_HOURS;
            }

            return $content;
        });
    }

    public function down(): void
    {
        $this->updateSiteContent(function (array $content): array {
            $content = $this->replaceQuickInfoHours($content, self::NEW_HOURS, self::OLD_HOURS, false);

            if (($content['footer']['scheduleHours'] ?? null) === self::FOOTER_HOURS) {
                $content['footer']['scheduleHours'] = self::OLD_HOURS;
            }

            return $content;
        });
    }

    private function updateSiteContent(callable $mutator): void
    {
        $row = DB::table('site_settings')->where('key', 'site_content')->first();
        if (! $row) {
            return;
        }

        $value = json_decode((string) $row->value, true);
        if (! is_array($value)) {
            return;
        }

        $next = $mutator($value);
        if ($next === $value) {
            return;
        }

        DB::table('site_settings')
            ->where('key', 'site_content')
            ->update([
                'value' => json_encode($next, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
                'updated_at' => now(),
            ]);

        Cache::forget('site-setting:site_content');
        Cache::forget('public:cms:site-content');
    }

    private function replaceQuickInfoHours(array $content, string $from, string $to, bool $appendRestLabel): array
    {
        foreach ($content['quickInfo']['cards'] ?? [] as $index => $card) {
            $points = $card['points'] ?? null;
            if (! is_array($points) || ! in_array($from, $points, true)) {
                continue;
            }

            $points = array_map(fn ($point) => $point === $from ? $to : $point, $points);
            if ($appendRestLabel && ! in_array(self::REST_LABEL, $points, true)) {
                $points[] = self::REST_LABEL;
            }
            if (! $appendRestLabel) {
                $points = array_values(array_filter($points, fn ($point): bool => $point !== self::REST_LABEL));
            }

            $content['quickInfo']['cards'][$index]['points'] = $points;
        }

        return $content;
    }
};
