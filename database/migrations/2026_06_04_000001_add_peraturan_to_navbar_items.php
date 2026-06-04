<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $setting = DB::table('site_settings')
            ->where('key', 'site_content')
            ->first();

        if (! $setting) {
            return;
        }

        $value = json_decode((string) $setting->value, true);
        if (! is_array($value) || ! isset($value['nav']['items'])) {
            return;
        }

        $items = $value['nav']['items'];
        $hasPeraturan = false;
        foreach ($items as $item) {
            if (($item['target'] ?? '') === '#peraturan') {
                $hasPeraturan = true;
                break;
            }
        }

        if (! $hasPeraturan) {
            $newItems = [];
            $inserted = false;
            foreach ($items as $item) {
                if (($item['target'] ?? '') === '#faq') {
                    $newItems[] = ['label' => 'Peraturan', 'target' => '#peraturan'];
                    $inserted = true;
                }
                $newItems[] = $item;
            }

            if (! $inserted) {
                $newItems[] = ['label' => 'Peraturan', 'target' => '#peraturan'];
            }

            $value['nav']['items'] = $newItems;

            DB::table('site_settings')
                ->where('id', $setting->id)
                ->update([
                    'value' => json_encode($value, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
                    'updated_at' => now(),
                ]);

            Cache::forget("site-setting:site_content");
            Cache::forget('public:cms:site-content');
        }
    }

    public function down(): void
    {
        $setting = DB::table('site_settings')
            ->where('key', 'site_content')
            ->first();

        if (! $setting) {
            return;
        }

        $value = json_decode((string) $setting->value, true);
        if (! is_array($value) || ! isset($value['nav']['items'])) {
            return;
        }

        $items = $value['nav']['items'];
        $newItems = [];
        foreach ($items as $item) {
            if (($item['target'] ?? '') !== '#peraturan') {
                $newItems[] = $item;
            }
        }

        $value['nav']['items'] = $newItems;

        DB::table('site_settings')
            ->where('id', $setting->id)
            ->update([
                'value' => json_encode($value, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
                'updated_at' => now(),
            ]);

        Cache::forget("site-setting:site_content");
        Cache::forget('public:cms:site-content');
    }
};
