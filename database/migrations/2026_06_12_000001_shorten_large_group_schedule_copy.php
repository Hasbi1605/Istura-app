<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    private const OLD_TITLE = 'Perlu penyesuaian kloter?';

    private const OLD_BODY = 'Rombongan Anda dibagi otomatis menjadi {jumlahKloter} kloter sesuai kapasitas layanan. Jika pembagian waktunya belum sesuai kebutuhan, silakan diskusikan dengan Admin ISTURA. Permintaan penyesuaian akan ditinjau berdasarkan ketersediaan jadwal dan kebutuhan operasional.';

    private const OLD_ACTION = 'Diskusikan via WhatsApp';

    private const NEW_TITLE = 'Perlu penyesuaian jadwal?';

    private const NEW_BODY = 'Jadwal rombongan dibagi menjadi {jumlahKloter} kloter. Diskusikan penyesuaian dengan Admin ISTURA sesuai ketersediaan layanan.';

    private const NEW_ACTION = 'Diskusi dengan Admin';

    public function up(): void
    {
        $this->replaceDefaults(
            self::OLD_TITLE,
            self::OLD_BODY,
            self::OLD_ACTION,
            self::NEW_TITLE,
            self::NEW_BODY,
            self::NEW_ACTION,
        );
    }

    public function down(): void
    {
        $this->replaceDefaults(
            self::NEW_TITLE,
            self::NEW_BODY,
            self::NEW_ACTION,
            self::OLD_TITLE,
            self::OLD_BODY,
            self::OLD_ACTION,
        );
    }

    private function replaceDefaults(
        string $fromTitle,
        string $fromBody,
        string $fromAction,
        string $toTitle,
        string $toBody,
        string $toAction,
    ): void {
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

        $schedule = $value['bookingWizard']['schedule'] ?? null;
        if (! is_array($schedule)) {
            return;
        }

        $changed = false;
        foreach ([
            'largeGroupTitle' => [$fromTitle, $toTitle],
            'largeGroupBody' => [$fromBody, $toBody],
            'largeGroupActionLabel' => [$fromAction, $toAction],
        ] as $key => [$from, $to]) {
            if (($schedule[$key] ?? null) === $from) {
                $value['bookingWizard']['schedule'][$key] = $to;
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
