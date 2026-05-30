<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('booking_slots', function (Blueprint $table) {
            $table->string('kind', 16)->default('active')->after('booking_id');
            $table->dropUnique('booking_slots_booking_id_slot_order_unique');
            $table->unique(['booking_id', 'kind', 'slot_order']);
        });
    }

    public function down(): void
    {
        Schema::table('booking_slots', function (Blueprint $table) {
            $table->dropUnique('booking_slots_booking_id_kind_slot_order_unique');
            $table->unique(['booking_id', 'slot_order']);
            $table->dropColumn('kind');
        });
    }
};
