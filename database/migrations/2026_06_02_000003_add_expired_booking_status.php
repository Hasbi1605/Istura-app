<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            $table->timestamp('expired_at')->nullable()->after('rejected_at')->index();
        });

        if (DB::getDriverName() === 'mysql') {
            DB::statement("ALTER TABLE bookings MODIFY status ENUM('Pending', 'Accepted', 'Rejected', 'Reschedule', 'Completed', 'Expired') NOT NULL DEFAULT 'Pending'");
            DB::statement("ALTER TABLE wa_templates MODIFY status_key ENUM('Pending', 'Accepted', 'Rejected', 'Reschedule', 'Completed', 'Expired') NOT NULL");
        }

        DB::table('wa_templates')->updateOrInsert(
            ['status_key' => 'Expired'],
            [
                'label' => 'Booking kedaluwarsa',
                'description' => 'Dikirim saat jadwal pending sudah terlewat tanpa keputusan admin.',
                'template' => implode("\n", [
                    'Halo Sobat ISTURA',
                    '',
                    '*Booking Kedaluwarsa*',
                    '',
                    'Yth. *{nama}*,',
                    'permohonan kunjungan dari *{instansi}* dengan kode *{kode}* belum sempat dikonfirmasi hingga jadwal yang diajukan terlewat.',
                    '',
                    'Tanggal kunjungan awal:',
                    '*{tanggal_awal}*',
                    '',
                    'Jadwal awal:',
                    '{jam}',
                    '',
                    'Silakan menunggu tawaran jadwal baru dari admin atau melakukan booking ulang sesuai slot yang tersedia.',
                    '',
                    'Salam hangat,',
                    'Admin ISTURA',
                ]),
                'updated_at' => now(),
                'created_at' => now(),
            ],
        );
    }

    public function down(): void
    {
        DB::table('wa_templates')->where('status_key', 'Expired')->delete();
        DB::table('bookings')->where('status', 'Expired')->update(['status' => 'Pending']);

        if (DB::getDriverName() === 'mysql') {
            DB::statement("ALTER TABLE wa_templates MODIFY status_key ENUM('Pending', 'Accepted', 'Rejected', 'Reschedule', 'Completed') NOT NULL");
            DB::statement("ALTER TABLE bookings MODIFY status ENUM('Pending', 'Accepted', 'Rejected', 'Reschedule', 'Completed') NOT NULL DEFAULT 'Pending'");
        }

        Schema::table('bookings', function (Blueprint $table) {
            $table->dropIndex(['expired_at']);
            $table->dropColumn('expired_at');
        });
    }
};
