<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            $table->dropUnique('bookings_active_slot_key_unique');
            $table->index('active_slot_key');
        });

        Schema::table('booking_slots', function (Blueprint $table) {
            $table->dropUnique('booking_slots_active_slot_key_unique');
            $table->index('active_slot_key');
        });
    }

    public function down(): void
    {
        Schema::table('booking_slots', function (Blueprint $table) {
            $table->dropIndex('booking_slots_active_slot_key_index');
            $table->unique('active_slot_key');
        });

        Schema::table('bookings', function (Blueprint $table) {
            $table->dropIndex('bookings_active_slot_key_index');
            $table->unique('active_slot_key');
        });
    }
};
