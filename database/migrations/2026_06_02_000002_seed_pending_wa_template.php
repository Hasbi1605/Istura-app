<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $exists = DB::table('wa_templates')->where('status_key', 'Pending')->exists();
        if ($exists) {
            return;
        }

        DB::table('wa_templates')->insert([
            'status_key' => 'Pending',
            'label' => 'Reschedule dibatalkan',
            'description' => 'Dikirim saat usulan reschedule dibatalkan dan booking kembali menunggu konfirmasi.',
            'template' => implode("\n", [
                "Halo Sobat ISTURA \u{1F44B}",
                '',
                '*Status Booking Masih Menunggu Konfirmasi*',
                '',
                'Yth. *{nama}*,',
                'usulan perubahan jadwal untuk booking dari *{instansi}* dengan kode *{kode}* belum dilanjutkan.',
                '',
                'Status booking saat ini masih *menunggu konfirmasi admin*.',
                '',
                'Tanggal kunjungan awal:',
                '*{tanggal_awal}*',
                '',
                'Jadwal awal:',
                '{jam}',
                '',
                'Catatan admin:',
                '*{catatan}*',
                '',
                'Admin ISTURA akan mengirim konfirmasi lanjutan setelah jadwal final ditetapkan.',
                '',
                'Salam hangat,',
                'Admin ISTURA',
            ]),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function down(): void
    {
        DB::table('wa_templates')->where('status_key', 'Pending')->delete();
    }
};
