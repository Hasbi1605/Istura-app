<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('booking_slots', function (Blueprint $table) {
            $table->id();
            $table->foreignId('booking_id')->constrained()->cascadeOnDelete();
            $table->unsignedSmallInteger('slot_order');
            $table->date('date');
            $table->string('date_label');
            $table->string('time', 5);
            $table->unsignedSmallInteger('group_size');
            $table->string('active_slot_key', 16)->nullable();
            $table->timestamps();

            $table->unique(['booking_id', 'slot_order']);
            $table->unique('active_slot_key');
            $table->index(['date', 'time']);
        });

        DB::table('bookings')
            ->orderBy('id')
            ->get(['id', 'date', 'date_label', 'time', 'group_size', 'status'])
            ->each(function ($booking) {
                DB::table('booking_slots')->insert([
                    'booking_id' => $booking->id,
                    'slot_order' => 1,
                    'date' => $booking->date,
                    'date_label' => $booking->date_label,
                    'time' => $booking->time,
                    'group_size' => min((int) $booking->group_size, 80),
                    'active_slot_key' => in_array($booking->status, ['Pending', 'Accepted', 'Reschedule', 'Completed'], true)
                        ? $booking->date.'|'.$booking->time
                        : null,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            });
    }

    public function down(): void
    {
        Schema::dropIfExists('booking_slots');
    }
};
