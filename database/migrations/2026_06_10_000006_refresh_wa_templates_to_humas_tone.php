<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Selaraskan tone template WA (Rejected, Reschedule, Pending, Expired,
     * Completed) dengan identitas "Humas Gedung Agung" seperti template
     * "Booking disetujui". Hanya memperbarui baris yang MASIH memakai default
     * lama (diawali "Halo Sobat ISTURA") agar kustomisasi admin tidak tertimpa.
     * Template Completed kini memakai variabel baru {dokumentasi}.
     */
    public function up(): void
    {
        $items = json_decode(file_get_contents(database_path('seeders/data/wa_templates.json')), true);
        $byId = collect($items)->keyBy('id');

        foreach (['Rejected', 'Reschedule', 'Pending', 'Expired', 'Completed'] as $statusKey) {
            $item = $byId->get($statusKey);
            if (! $item) {
                continue;
            }

            DB::table('wa_templates')
                ->where('status_key', $statusKey)
                ->where('template', 'like', 'Halo Sobat ISTURA%')
                ->update([
                    'label' => $item['label'],
                    'description' => $item['description'],
                    'template' => $item['template'],
                    'updated_at' => now(),
                ]);
        }
    }

    public function down(): void
    {
        // Tidak reversibel: konten lama tidak disimpan. Gunakan "Pulihkan
        // default" di admin atau re-seed bila perlu mengembalikan teks.
    }
};
