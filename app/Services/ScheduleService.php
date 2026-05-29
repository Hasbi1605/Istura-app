<?php

namespace App\Services;

use App\Models\Booking;
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

        $overrides = ScheduleOverride::whereBetween('date', [$from->toDateString(), $to->toDateString()])
            ->get()
            ->groupBy(fn ($o) => $o->date->toDateString());

        $bookings = Booking::whereBetween('date', [$from->toDateString(), $to->toDateString()])
            ->get()
            ->groupBy(fn ($b) => $b->date->toDateString());

        $days = [];
        foreach (CarbonPeriod::create($from, '1 day', $to) as $cursor) {
            $key = $cursor->toDateString();
            $closedByDefault = $this->isDefaultHoliday($cursor);

            $slots = collect(self::TIME_SLOTS)->map(function (string $time) use ($key, $closedByDefault, $overrides, $bookings) {
                return [
                    'time' => $time,
                    'status' => $this->resolveSlotStatus($key, $time, $closedByDefault, $overrides, $bookings),
                    'custom' => $this->slotHasOverride($key, $time, $overrides),
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

    private function resolveSlotStatus(
        string $dateKey,
        string $time,
        bool $closedByDefault,
        Collection $overrides,
        Collection $bookings,
    ): string {
        $override = $overrides->get($dateKey)?->firstWhere('time', $time);
        if ($override) {
            return $override->status;
        }

        $booking = $bookings->get($dateKey)?->firstWhere('time', $time);
        if ($booking) {
            return match ($booking->status) {
                'Pending' => 'Held',
                'Accepted', 'Completed' => 'Booked',
                'Reschedule' => 'Reschedule Hold',
                default => $closedByDefault ? 'Closed' : 'Available',
            };
        }

        return $closedByDefault ? 'Closed' : 'Available';
    }

    private function slotHasOverride(string $dateKey, string $time, Collection $overrides): bool
    {
        $override = $overrides->get($dateKey)?->firstWhere('time', $time);

        return $override !== null;
    }
}
