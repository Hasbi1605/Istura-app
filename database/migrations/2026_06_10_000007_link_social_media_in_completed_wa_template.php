<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Ubah label sosmed teks polos pada template WA "Completed" menjadi tautan
     * asli (sama dengan footer) agar bisa diklik di WhatsApp. Memakai str_replace
     * tersurgikal sehingga hanya baris sosmed yang berubah; bagian lain template
     * (termasuk kustomisasi admin) tidak tersentuh.
     */
    public function up(): void
    {
        $row = DB::table('wa_templates')->where('status_key', 'Completed')->first();
        if (! $row) {
            return;
        }

        $updated = str_replace(
            [
                'Instagram: istanakepresidenanyogyakarta',
                'YouTube: Istana Kepresidenan Yogyakarta',
            ],
            [
                'Instagram: https://www.instagram.com/istanakepresidenanyogyakarta/',
                'YouTube: https://www.youtube.com/@istanakepresidenanyogyakarta',
            ],
            $row->template,
        );

        if ($updated !== $row->template) {
            DB::table('wa_templates')
                ->where('status_key', 'Completed')
                ->update([
                    'template' => $updated,
                    'updated_at' => now(),
                ]);
        }
    }

    public function down(): void
    {
        // Tidak reversibel: gunakan "Pulihkan default" di admin atau re-seed.
    }
};
