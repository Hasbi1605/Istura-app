<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            // Tautan dokumentasi (mis. folder Google Drive foto kunjungan) yang
            // diisi admin saat menandai booking selesai. Dipakai placeholder
            // {dokumentasi} pada template WA "Tandai selesai & permintaan feedback".
            $table->text('documentation_link')->nullable()->after('note');
        });
    }

    public function down(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            $table->dropColumn('documentation_link');
        });
    }
};
