<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    private const SLOT_CAPACITY = 80;

    private const ACTIVE_STATUSES = ['Pending', 'Accepted', 'Reschedule'];

    private const TIME_SLOTS = ['08.00', '09.00', '10.00', '11.00', '12.00', '13.00', '14.00'];

    public function up(): void
    {
        DB::table('bookings')
            ->where('group_size', '>', self::SLOT_CAPACITY)
            ->orderBy('id')
            ->get(['id', 'date', 'date_label', 'time', 'group_size', 'status'])
            ->each(function ($booking) {
                $dateKey = substr((string) $booking->date, 0, 10);
                $slots = DB::table('booking_slots')
                    ->where('booking_id', $booking->id)
                    ->where('kind', 'active')
                    ->orderBy('slot_order')
                    ->get();

                if ($slots->count() !== 1 || (int) $slots->first()->group_size !== self::SLOT_CAPACITY) {
                    return;
                }

                $segmentSizes = $this->splitGroupSizes((int) $booking->group_size);
                $times = $this->orderedTimesForDate($dateKey);
                $startIndex = array_search($booking->time, $times, true);
                if ($startIndex === false) {
                    return;
                }

                $selectedTimes = array_slice($times, $startIndex, count($segmentSizes));
                if (count($selectedTimes) < count($segmentSizes)) {
                    return;
                }

                DB::table('booking_slots')
                    ->where('booking_id', $booking->id)
                    ->where('kind', 'active')
                    ->delete();

                $timestamp = now();
                foreach ($selectedTimes as $index => $time) {
                    DB::table('booking_slots')->insert([
                        'booking_id' => $booking->id,
                        'kind' => 'active',
                        'slot_order' => $index + 1,
                        'date' => $dateKey,
                        'date_label' => $booking->date_label,
                        'time' => $time,
                        'group_size' => $segmentSizes[$index],
                        'active_slot_key' => in_array($booking->status, self::ACTIVE_STATUSES, true)
                            ? $dateKey.'|'.$time
                            : null,
                        'created_at' => $timestamp,
                        'updated_at' => $timestamp,
                    ]);
                }
            });
    }

    public function down(): void
    {
        DB::table('bookings')
            ->where('group_size', '>', self::SLOT_CAPACITY)
            ->orderBy('id')
            ->get(['id', 'date', 'date_label', 'time', 'group_size', 'status'])
            ->each(function ($booking) {
                $dateKey = substr((string) $booking->date, 0, 10);
                $slots = DB::table('booking_slots')
                    ->where('booking_id', $booking->id)
                    ->where('kind', 'active')
                    ->orderBy('slot_order')
                    ->get();

                if ($slots->count() <= 1) {
                    return;
                }

                DB::table('booking_slots')
                    ->where('booking_id', $booking->id)
                    ->where('kind', 'active')
                    ->delete();

                DB::table('booking_slots')->insert([
                    'booking_id' => $booking->id,
                    'kind' => 'active',
                    'slot_order' => 1,
                    'date' => $dateKey,
                    'date_label' => $booking->date_label,
                    'time' => $booking->time,
                    'group_size' => min((int) $booking->group_size, self::SLOT_CAPACITY),
                    'active_slot_key' => in_array($booking->status, ['Pending', 'Accepted', 'Reschedule', 'Completed'], true)
                        ? $dateKey.'|'.$booking->time
                        : null,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            });
    }

    /**
     * @return array<int, int>
     */
    private function splitGroupSizes(int $groupSize): array
    {
        $requiredSlots = max(1, (int) ceil($groupSize / self::SLOT_CAPACITY));
        $baseSize = intdiv($groupSize, $requiredSlots);
        $remainder = $groupSize % $requiredSlots;

        return array_map(
            fn (int $index): int => $baseSize + ($index < $remainder ? 1 : 0),
            range(0, $requiredSlots - 1),
        );
    }

    /**
     * @return array<int, string>
     */
    private function orderedTimesForDate(string $date): array
    {
        return collect(self::TIME_SLOTS)
            ->merge(DB::table('schedule_overrides')->whereDate('date', $date)->pluck('time'))
            ->unique()
            ->sort()
            ->values()
            ->all();
    }
};
