<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Ubah relasi feedback dari 1:1 (hasOne) menjadi 1:N (hasMany) per booking.
 *
 * - Hapus unique constraint pada feedbacks.booking_id dan feedbacks.code.
 * - Tambahkan feedback_expires_at ke bookings (diset completed_at + 14 hari).
 * - Backfill feedback_expires_at untuk booking Completed yang sudah ada.
 */
return new class extends Migration
{
    public function up(): void
    {
        // 1. Hapus unique constraints pada feedbacks.
        // Perlu drop FK dulu karena MySQL tidak bisa drop index yang backing FK.
        Schema::table('feedbacks', function (Blueprint $table) {
            $table->dropForeign(['booking_id']);
        });

        Schema::table('feedbacks', function (Blueprint $table) {
            $table->dropUnique('feedbacks_booking_id_unique');
            $table->dropUnique('feedbacks_code_unique');
        });

        // Re-add non-unique index pada booking_id + re-add FK.
        // `code` sudah punya index dari create_feedbacks_table.
        Schema::table('feedbacks', function (Blueprint $table) {
            $table->index('booking_id', 'feedbacks_booking_id_index');
            $table->foreign('booking_id')->references('id')->on('bookings')->nullOnDelete();
        });

        // 2. Tambah feedback_expires_at ke bookings
        Schema::table('bookings', function (Blueprint $table) {
            $table->timestamp('feedback_expires_at')->nullable()->after('completed_at');
        });

        // 3. Backfill: booking Completed yang sudah ada mendapat expiry 14 hari dari completed_at
        $driver = Schema::getConnection()->getDriverName();
        if ($driver === 'sqlite') {
            DB::statement(
                "UPDATE bookings SET feedback_expires_at = datetime(completed_at, '+14 days') WHERE status = 'Completed' AND completed_at IS NOT NULL AND feedback_expires_at IS NULL"
            );
        } else {
            DB::statement(
                "UPDATE bookings SET feedback_expires_at = DATE_ADD(completed_at, INTERVAL 14 DAY) WHERE status = 'Completed' AND completed_at IS NOT NULL AND feedback_expires_at IS NULL"
            );
        }
    }

    public function down(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            $table->dropColumn('feedback_expires_at');
        });

        Schema::table('feedbacks', function (Blueprint $table) {
            $table->dropForeign(['booking_id']);
            $table->dropIndex('feedbacks_booking_id_index');
        });

        Schema::table('feedbacks', function (Blueprint $table) {
            $table->unique('booking_id', 'feedbacks_booking_id_unique');
            $table->unique('code', 'feedbacks_code_unique');
            $table->foreign('booking_id')->references('id')->on('bookings')->nullOnDelete();
        });
    }
};
