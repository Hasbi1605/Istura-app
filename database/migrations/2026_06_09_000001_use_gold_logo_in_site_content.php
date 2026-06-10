<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    private const OLD_LOGO = '/assets/gedung-agung-white.webp';

    private const NEW_LOGO = '/assets/gedung-agung-gold.webp';

    public function up(): void
    {
        $this->swapLogo(self::OLD_LOGO, self::NEW_LOGO);
    }

    public function down(): void
    {
        $this->swapLogo(self::NEW_LOGO, self::OLD_LOGO);
    }

    private function swapLogo(string $from, string $to): void
    {
        $setting = DB::table('site_settings')
            ->where('key', 'site_content')
            ->first();

        if (! $setting) {
            return;
        }

        $value = json_decode((string) $setting->value, true);
        if (! is_array($value)) {
            return;
        }

        $changed = false;

        foreach (['nav', 'footer'] as $section) {
            if (isset($value[$section]['logoSrc']) && $value[$section]['logoSrc'] === $from) {
                $value[$section]['logoSrc'] = $to;
                $changed = true;
            }
        }

        if (! $changed) {
            return;
        }

        DB::table('site_settings')
            ->where('id', $setting->id)
            ->update([
                'value' => json_encode($value, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
                'updated_at' => now(),
            ]);

        Cache::forget('site-setting:site_content');
        Cache::forget('public:cms:site-content');
    }
};
