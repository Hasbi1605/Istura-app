<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $setting = DB::table('site_settings')->where('key', 'site_content')->first();

        if (! $setting) {
            return;
        }

        $value = json_decode((string) $setting->value, true);
        if (! is_array($value)) {
            return;
        }

        $changed = false;
        $cards = data_get($value, 'quickInfo.cards', []);
        if (is_array($cards)) {
            foreach ($cards as $index => $card) {
                $points = $card['points'] ?? [];
                if (is_array($points)) {
                    $nextPoints = array_map(
                        fn ($point) => $point === 'Senin - Kamis' ? 'Senin - Jumat' : $point,
                        $points,
                    );
                    if ($nextPoints !== $points) {
                        data_set($value, "quickInfo.cards.{$index}.points", $nextPoints);
                        $changed = true;
                    }
                }
            }
        }

        if (data_get($value, 'footer.scheduleDays') === 'Senin - Kamis') {
            data_set($value, 'footer.scheduleDays', 'Senin - Jumat');
            $changed = true;
        }

        if (! $changed) {
            return;
        }

        DB::table('site_settings')
            ->where('id', $setting->id)
            ->update([
                'value' => json_encode($value),
                'updated_at' => now(),
            ]);

        Cache::forget('site-setting:site_content');
        Cache::forget('public:cms:site-content');
    }

    public function down(): void
    {
        // No-op: avoid rewriting CMS copy that may have been edited after deploy.
    }
};
