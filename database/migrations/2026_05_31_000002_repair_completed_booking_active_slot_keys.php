<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $completedBookingIds = DB::table('bookings')
            ->where('status', 'Completed')
            ->pluck('id');

        DB::table('bookings')
            ->where('status', 'Completed')
            ->update(['active_slot_key' => null]);

        DB::table('booking_slots')
            ->whereIn('booking_id', $completedBookingIds)
            ->update(['active_slot_key' => null]);
    }

    public function down(): void
    {
        DB::table('bookings')
            ->where('status', 'Completed')
            ->whereNotNull('date')
            ->whereNotNull('time')
            ->orderBy('id')
            ->get(['id', 'date', 'time'])
            ->each(function ($booking) {
                $dateKey = substr((string) $booking->date, 0, 10);

                DB::table('bookings')
                    ->where('id', $booking->id)
                    ->update(['active_slot_key' => $dateKey.'|'.$booking->time]);
            });

        DB::table('booking_slots')
            ->whereIn('booking_id', DB::table('bookings')->where('status', 'Completed')->select('id'))
            ->whereNotNull('date')
            ->whereNotNull('time')
            ->orderBy('id')
            ->get(['id', 'date', 'time'])
            ->each(function ($slot) {
                $dateKey = substr((string) $slot->date, 0, 10);

                DB::table('booking_slots')
                    ->where('id', $slot->id)
                    ->update(['active_slot_key' => $dateKey.'|'.$slot->time]);
            });
    }
};
