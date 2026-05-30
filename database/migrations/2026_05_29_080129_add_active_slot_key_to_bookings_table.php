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
            $table->string('active_slot_key', 16)->nullable()->after('time');
        });

        DB::table('bookings')
            ->whereIn('status', ['Pending', 'Accepted', 'Reschedule', 'Completed'])
            ->orderBy('id')
            ->get(['id', 'date', 'time'])
            ->each(function ($booking) {
                DB::table('bookings')
                    ->where('id', $booking->id)
                    ->update(['active_slot_key' => $booking->date.'|'.$booking->time]);
            });

        Schema::table('bookings', function (Blueprint $table) {
            $table->unique('active_slot_key');
        });
    }

    public function down(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            $table->dropUnique(['active_slot_key']);
            $table->dropColumn('active_slot_key');
        });
    }
};
