<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Hanya menyimpan slot yang dimodifikasi admin (Closed paksa, Held manual,
 * dsb). Default slot dihitung di runtime via ScheduleService dari kombinasi
 * VISIT_TIME_SLOTS + isDefaultHoliday().
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('schedule_overrides', function (Blueprint $table) {
            $table->id();
            $table->date('date');
            $table->string('time', 5);
            $table->enum('status', ['Available', 'Held', 'Booked', 'Closed', 'Reschedule Hold']);
            $table->boolean('custom')->default(false);
            $table->string('note')->nullable();
            $table->timestamps();

            $table->unique(['date', 'time']);
            $table->index('date');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('schedule_overrides');
    }
};
