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
 * Default operasional Senin–Kamis 08.00–14.00 WIB; Jumat/Sabtu/Minggu Closed.
 * Override admin disimpan di schedule_overrides; default lainnya dihitung saat
 * runtime supaya tidak perlu pre-generate seluruh kalender.
 */
class ScheduleService
{
    public const TIME_SLOTS = ['08.00', '09.00', '10.00', '11.00', '12.00', '13.00', '14.00'];

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
                return [
                    'time' => $time,
                    'status' => $this->resolveSlotStatus($key, $time, $closedByDefault, $overrides, $bookings, $bookingSlots),
                    'custom' => ! in_array($time, self::TIME_SLOTS, true),
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

        $slotQuery = BookingSlot::with('booking')
            ->where('active_slot_key', BookingSlot::slotKey($dateKey, $time))
            ->when($ignoreBookingId, fn ($query) => $query->where('booking_id', '!=', $ignoreBookingId));

        if ($lockBookings) {
            $slotQuery->lockForUpdate();
        }

        $bookingSlot = $slotQuery->first();
        if ($bookingSlot?->booking) {
            return $this->statusFromBooking($bookingSlot->booking);
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

        $override = ScheduleOverride::whereDate('date', $dateKey)
            ->where('time', $time)
            ->first();
        if ($override) {
            return $override->status;
        }

        if (! in_array($time, self::TIME_SLOTS, true)) {
            return 'Closed';
        }

        return $this->isDefaultHoliday($date) ? 'Closed' : 'Available';
    }

    private function resolveSlotStatus(
        string $dateKey,
        string $time,
        bool $closedByDefault,
        Collection $overrides,
        Collection $bookings,
        Collection $bookingSlots,
    ): string {
        $bookingSlot = $bookingSlots->get($dateKey)?->first(
            fn ($entry) => $entry->time === $time && $entry->booking?->isActiveForSchedule(),
        );
        if ($bookingSlot?->booking) {
            return $this->statusFromBooking($bookingSlot->booking);
        }

        $booking = $bookings->get($dateKey)?->first(
            fn ($entry) => $entry->time === $time && in_array($entry->status, Booking::ACTIVE_STATUSES, true),
        );
        if ($booking) {
            return $this->statusFromBooking($booking);
        }

        $override = $overrides->get($dateKey)?->firstWhere('time', $time);
        if ($override) {
            return $override->status;
        }

        if (! in_array($time, self::TIME_SLOTS, true)) {
            return 'Closed';
        }

        return $closedByDefault ? 'Closed' : 'Available';
    }

    private function statusFromBooking(Booking $booking): string
    {
        return match ($booking->status) {
            'Pending' => 'Held',
            'Accepted', 'Completed' => 'Booked',
            'Reschedule' => 'Reschedule Hold',
            default => 'Available',
        };
    }
}
