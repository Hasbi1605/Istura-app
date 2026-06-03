<?php

namespace App\Services;

use App\Models\Booking;
use App\Models\BookingSlot;
use App\Models\ScheduleOverride;
use Carbon\Carbon;
use Carbon\CarbonPeriod;
use Illuminate\Support\Collection;

/**
 * Port of buildScheduleHorizon + applyBookingsToSchedule from App.tsx.
 *
 * Default operasional Senin–Kamis 08.00–11.00 dan 13.00–14.00 WIB;
 * Jumat/Sabtu/Minggu Closed.
 * Override admin disimpan di schedule_overrides; default lainnya dihitung saat
 * runtime supaya tidak perlu pre-generate seluruh kalender.
 */
class ScheduleService
{
    public const TIME_SLOTS = ['08.00', '09.00', '10.00', '11.00', '13.00', '14.00'];

    private const ID_MONTHS = [
        1 => 'Januari', 2 => 'Februari', 3 => 'Maret', 4 => 'April',
        5 => 'Mei', 6 => 'Juni', 7 => 'Juli', 8 => 'Agustus',
        9 => 'September', 10 => 'Oktober', 11 => 'November', 12 => 'Desember',
    ];

    private const ID_DAYS = [
        0 => 'Minggu', 1 => 'Senin', 2 => 'Selasa', 3 => 'Rabu',
        4 => 'Kamis', 5 => 'Jumat', 6 => 'Sabtu',
    ];

    /**
     * @return array<int, array{date:string,label:string,short:string,slots:array<int, array{time:string,status:string,custom:bool}>}>
     */
    public function buildHorizon(?Carbon $from = null, ?Carbon $to = null): array
    {
        $from = ($from ?? Carbon::today('Asia/Jakarta'))->copy()->startOfDay();
        $to = ($to ?? $from->copy()->addMonths(2))->copy()->endOfDay();

        $overrides = ScheduleOverride::whereDate('date', '>=', $from->toDateString())
            ->whereDate('date', '<=', $to->toDateString())
            ->get()
            ->groupBy(fn ($o) => $o->date->toDateString());

        $bookings = Booking::whereDate('date', '>=', $from->toDateString())
            ->whereDate('date', '<=', $to->toDateString())
            ->get()
            ->groupBy(fn ($b) => $b->date->toDateString());

        $bookingSlots = BookingSlot::with('booking')
            ->whereDate('date', '>=', $from->toDateString())
            ->whereDate('date', '<=', $to->toDateString())
            ->get()
            ->groupBy(fn ($slot) => $slot->date->toDateString());

        $days = [];
        foreach (CarbonPeriod::create($from, '1 day', $to) as $cursor) {
            $key = $cursor->toDateString();
            $closedByDefault = $this->isDefaultHoliday($cursor);
            $times = collect(self::TIME_SLOTS)
                ->merge($overrides->get($key)?->pluck('time') ?? [])
                ->merge($bookings->get($key)?->pluck('time') ?? [])
                ->merge($bookingSlots->get($key)?->pluck('time') ?? [])
                ->unique()
                ->sort()
                ->values();

            $slots = $times->map(function (string $time) use ($key, $closedByDefault, $overrides, $bookings, $bookingSlots) {
                $bookingCount = $this->activeBookingCount($key, $time, $bookings, $bookingSlots);

                return [
                    'time' => $time,
                    'status' => $this->resolveSlotStatus($key, $time, $closedByDefault, $overrides, $bookings, $bookingSlots),
                    'custom' => ! in_array($time, self::TIME_SLOTS, true),
                    'bookingCount' => $bookingCount,
                    'overbooked' => $bookingCount > 1,
                ];
            })->all();

            $days[] = [
                'date' => $key,
                'label' => $this->formatLongDate($cursor),
                'short' => $cursor->day.' '.substr(self::ID_MONTHS[$cursor->month], 0, 3),
                'slots' => $slots,
            ];
        }

        return $days;
    }

    public function isDefaultHoliday(Carbon $date): bool
    {
        return in_array($date->dayOfWeek, [0, 5, 6], true); // Min, Jum, Sab
    }

    public function formatLongDate(Carbon $date): string
    {
        return self::ID_DAYS[$date->dayOfWeek].', '.$date->day.' '.self::ID_MONTHS[$date->month].' '.$date->year;
    }

    /**
     * @return array<int, string>
     */
    public function orderedTimesForDate(Carbon $date): array
    {
        $dateKey = $date->toDateString();

        return collect(self::TIME_SLOTS)
            ->merge(ScheduleOverride::whereDate('date', $dateKey)->pluck('time'))
            ->unique()
            ->sort()
            ->values()
            ->all();
    }

    public function slotStatusFor(Carbon|string $date, string $time, bool $lockBookings = false, ?int $ignoreBookingId = null): string
    {
        $date = $date instanceof Carbon
            ? $date->copy()->startOfDay()
            : Carbon::createFromFormat('Y-m-d', $date, 'Asia/Jakarta')->startOfDay();
        $dateKey = $date->toDateString();

        $override = ScheduleOverride::whereDate('date', $dateKey)
            ->where('time', $time)
            ->first();
        if ($override?->status === 'Closed') {
            return $override->status;
        }

        $slotQuery = BookingSlot::with('booking')
            ->where('active_slot_key', BookingSlot::slotKey($dateKey, $time))
            ->when($ignoreBookingId, fn ($query) => $query->where('booking_id', '!=', $ignoreBookingId));

        if ($lockBookings) {
            $slotQuery->lockForUpdate();
        }

        $bookingSlot = $slotQuery->first();
        if ($bookingSlot?->booking) {
            return $this->statusFromBookingSlot($bookingSlot);
        }

        $bookingQuery = Booking::whereDate('date', $dateKey)
            ->where('time', $time)
            ->whereIn('status', Booking::ACTIVE_STATUSES)
            ->when($ignoreBookingId, fn ($query) => $query->whereKeyNot($ignoreBookingId));

        if ($lockBookings) {
            $bookingQuery->lockForUpdate();
        }

        $booking = $bookingQuery->first();
        if ($booking) {
            return $this->statusFromBooking($booking);
        }

        if ($override?->status === 'Available') {
            return 'Available';
        }

        if (! in_array($time, self::TIME_SLOTS, true)) {
            return 'Closed';
        }

        return $this->isDefaultHoliday($date) ? 'Closed' : 'Available';
    }

    /**
     * @param  array<int, string>  $times
     * @return array<string, string>
     */
    public function slotStatusesFor(Carbon|string $date, array $times, bool $lockBookings = false, ?int $ignoreBookingId = null): array
    {
        $date = $date instanceof Carbon
            ? $date->copy()->startOfDay()
            : Carbon::createFromFormat('Y-m-d', $date, 'Asia/Jakarta')->startOfDay();
        $dateKey = $date->toDateString();
        $times = collect($times)->unique()->values();

        if ($times->isEmpty()) {
            return [];
        }

        $defaultStatus = $this->isDefaultHoliday($date) ? 'Closed' : 'Available';
        $statuses = $times
            ->mapWithKeys(fn (string $time): array => [
                $time => in_array($time, self::TIME_SLOTS, true) ? $defaultStatus : 'Closed',
            ])
            ->all();

        $overrides = ScheduleOverride::whereDate('date', $dateKey)
            ->whereIn('time', $times->all())
            ->get()
            ->keyBy('time');

        foreach ($overrides as $time => $override) {
            $statuses[$time] = $override->status;
        }

        $availableTimes = $times
            ->reject(fn (string $time): bool => $overrides->get($time)?->status === 'Closed')
            ->values();

        if ($availableTimes->isEmpty()) {
            return $statuses;
        }

        $slotKeys = $availableTimes
            ->map(fn (string $time): string => BookingSlot::slotKey($dateKey, $time))
            ->all();
        $slotQuery = BookingSlot::with('booking')
            ->whereIn('active_slot_key', $slotKeys)
            ->when($ignoreBookingId, fn ($query) => $query->where('booking_id', '!=', $ignoreBookingId));

        if ($lockBookings) {
            $slotQuery->lockForUpdate();
        }

        $bookingSlots = $slotQuery->get()->groupBy('time');
        foreach ($availableTimes as $time) {
            $bookingSlot = $bookingSlots->get($time)?->first(fn (BookingSlot $slot): bool => $slot->booking !== null);
            if ($bookingSlot?->booking) {
                $statuses[$time] = $this->statusFromBookingSlot($bookingSlot);
            }
        }

        $timesWithoutSlots = $availableTimes
            ->reject(fn (string $time): bool => ($statuses[$time] ?? null) !== 'Available')
            ->values();

        if ($timesWithoutSlots->isEmpty()) {
            return $statuses;
        }

        $bookingQuery = Booking::whereDate('date', $dateKey)
            ->whereIn('time', $timesWithoutSlots->all())
            ->whereIn('status', Booking::ACTIVE_STATUSES)
            ->when($ignoreBookingId, fn ($query) => $query->whereKeyNot($ignoreBookingId));

        if ($lockBookings) {
            $bookingQuery->lockForUpdate();
        }

        $bookings = $bookingQuery->get()->keyBy('time');
        foreach ($timesWithoutSlots as $time) {
            $booking = $bookings->get($time);
            if ($booking) {
                $statuses[$time] = $this->statusFromBooking($booking);
            }
        }

        return $statuses;
    }

    private function resolveSlotStatus(
        string $dateKey,
        string $time,
        bool $closedByDefault,
        Collection $overrides,
        Collection $bookings,
        Collection $bookingSlots,
    ): string {
        $override = $overrides->get($dateKey)?->firstWhere('time', $time);
        if ($override?->status === 'Closed') {
            return $override->status;
        }

        $bookingSlot = $bookingSlots->get($dateKey)?->first(
            fn ($entry) => $entry->time === $time && $entry->booking?->isActiveForSchedule(),
        );
        if ($bookingSlot?->booking) {
            return $this->statusFromBookingSlot($bookingSlot);
        }

        $booking = $bookings->get($dateKey)?->first(
            fn ($entry) => $entry->time === $time && in_array($entry->status, Booking::ACTIVE_STATUSES, true),
        );
        if ($booking) {
            return $this->statusFromBooking($booking);
        }

        if ($override?->status === 'Available') {
            return 'Available';
        }

        if (! in_array($time, self::TIME_SLOTS, true)) {
            return 'Closed';
        }

        return $closedByDefault ? 'Closed' : 'Available';
    }

    private function activeBookingCount(
        string $dateKey,
        string $time,
        Collection $bookings,
        Collection $bookingSlots,
    ): int {
        $slotBookingIds = $bookingSlots->get($dateKey)
            ?->filter(fn ($entry) => $entry->time === $time && $entry->booking?->isActiveForSchedule())
            ->pluck('booking_id')
            ->all() ?? [];

        $legacyBookingIds = $bookings->get($dateKey)
            ?->filter(fn ($entry) => $entry->time === $time && in_array($entry->status, Booking::ACTIVE_STATUSES, true))
            ->pluck('id')
            ->all() ?? [];

        return collect($slotBookingIds)
            ->merge($legacyBookingIds)
            ->unique()
            ->count();
    }

    private function statusFromBooking(Booking $booking): string
    {
        return match ($booking->status) {
            'Pending' => 'Held',
            'Accepted' => 'Booked',
            'Reschedule' => 'Reschedule Hold',
            default => 'Available',
        };
    }

    private function statusFromBookingSlot(BookingSlot $slot): string
    {
        if ($slot->kind === BookingSlot::KIND_PROPOSED) {
            return 'Reschedule Hold';
        }

        return $this->statusFromBooking($slot->booking);
    }
}
