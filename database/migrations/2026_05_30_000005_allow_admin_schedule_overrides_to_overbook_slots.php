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
        $this->ensureNoDuplicateActiveSlotKeys('booking_slots');
        $this->ensureNoDuplicateActiveSlotKeys('bookings');

        Schema::table('booking_slots', function (Blueprint $table) {
            $table->dropIndex('booking_slots_active_slot_key_index');
            $table->unique('active_slot_key');
        });

        Schema::table('bookings', function (Blueprint $table) {
            $table->dropIndex('bookings_active_slot_key_index');
            $table->unique('active_slot_key');
        });
    }

    private function ensureNoDuplicateActiveSlotKeys(string $table): void
    {
        $duplicates = DB::table($table)
            ->whereNotNull('active_slot_key')
            ->groupBy('active_slot_key')
            ->havingRaw('COUNT(*) > 1')
            ->pluck('active_slot_key')
            ->all();

        if ($duplicates === []) {
            return;
        }

        throw new RuntimeException(sprintf(
            'Cannot rollback overbooking migration: %s has duplicate active_slot_key values (%s). Resolve duplicate active slots before restoring the unique index.',
            $table,
            implode(', ', array_slice($duplicates, 0, 5)),
        ));
    }
};
