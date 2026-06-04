<?php

namespace App\Services;

use App\Models\Booking;
use App\Models\BookingSlot;
use App\Models\NationalHoliday;
use App\Models\ScheduleOverride;
use App\Support\PublicCache;
use Carbon\Carbon;
use Carbon\CarbonPeriod;
use Illuminate\Contracts\Cache\LockTimeoutException;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
use Throwable;

/**
 * Port of buildScheduleHorizon + applyBookingsToSchedule from App.tsx.
 *
 * Default operasional Senin-Kamis 08.00-11.00 dan 13.00-14.00 WIB;
 * Jumat/Sabtu/Minggu serta tanggal merah nasional Closed. Override admin
 * disimpan di schedule_overrides; default lainnya dihitung saat runtime supaya
 * tidak perlu pre-generate seluruh kalender.
 */
class ScheduleService
{
    public const TIME_SLOTS = ['08.00', '09.00', '10.00', '11.00', '13.00', '14.00'];

    public function __construct(private readonly NationalHolidaySyncService $holidaySync) {}

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
     * @return array<int, array{date:string,label:string,short:string,closureReason:?array,holiday:?array,slots:array<int, array{time:string,status:string,custom:bool,closureReason:?array}>}>
     */
    public function buildHorizon(?Carbon $from = null, ?Carbon $to = null): array
    {
        $from = ($from ?? Carbon::today('Asia/Jakarta'))->copy()->startOfDay();
        $to = ($to ?? $from->copy()->addMonths(2))->copy()->endOfDay();

        $this->ensureHolidayDataForRange($from, $to);

        $overrides = ScheduleOverride::whereDate('date', '>=', $from->toDateString())
            ->whereDate('date', '<=', $to->toDateString())
            ->get()
            ->groupBy(fn ($o) => $o->date->toDateString());

        $nationalHolidays = NationalHoliday::whereDate('date', '>=', $from->toDateString())
            ->whereDate('date', '<=', $to->toDateString())
            ->get()
            ->keyBy(fn (NationalHoliday $holiday) => $holiday->date->toDateString());

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
            $holiday = $nationalHolidays->get($key);
            $defaultClosure = $this->defaultClosureFor($cursor, $holiday, true);
            $closedByDefault = $defaultClosure !== null;
            $times = collect(self::TIME_SLOTS)
                ->merge($overrides->get($key)?->pluck('time') ?? [])
                ->merge($bookings->get($key)?->pluck('time') ?? [])
                ->merge($bookingSlots->get($key)?->pluck('time') ?? [])
                ->unique()
                ->sort()
                ->values();

            $slots = $times->map(function (string $time) use ($key, $closedByDefault, $defaultClosure, $overrides, $bookings, $bookingSlots) {
                $bookingCount = $this->activeBookingCount($key, $time, $bookings, $bookingSlots);
                $override = $overrides->get($key)?->firstWhere('time', $time);
                $status = $this->resolveSlotStatus($key, $time, $closedByDefault, $overrides, $bookings, $bookingSlots);

                return [
                    'time' => $time,
                    'status' => $status,
                    'custom' => ! in_array($time, self::TIME_SLOTS, true),
                    'bookingCount' => $bookingCount,
                    'overbooked' => $bookingCount > 1,
                    'closureReason' => $this->slotClosureReason($status, $override, $defaultClosure),
                ];
            })->all();

            $days[] = [
                'date' => $key,
                'label' => $this->formatLongDate($cursor),
                'short' => $cursor->day.' '.substr(self::ID_MONTHS[$cursor->month], 0, 3),
                'closureReason' => $defaultClosure,
                'holiday' => $this->holidayPayload($holiday),
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

    public function ensureHolidayDataForDate(Carbon $date): void
    {
        $this->ensureHolidayDataForRange($date, $date);
    }

    public function ensureHolidayDataForRange(Carbon $from, Carbon $to): void
    {
        if (! (bool) config('services.indonesian_holidays.auto_sync', true)) {
            return;
        }

        if (app()->environment('testing') && ! (bool) config('services.indonesian_holidays.auto_sync_in_tests', false)) {
            return;
        }

        $years = $this->yearsForRange($from, $to);
        $yearsToSync = $this->holidayYearsNeedingSync($years);
        if ($yearsToSync === []) {
            return;
        }

        $attemptKey = 'national-holidays:auto-sync:attempt:'.implode('-', $yearsToSync);
        if (! Cache::add($attemptKey, true, now()->addMinutes((int) config('services.indonesian_holidays.auto_sync_retry_minutes', 5)))) {
            return;
        }

        $lock = Cache::lock('national-holidays:auto-sync:lock:'.implode('-', $years), (int) config('services.indonesian_holidays.timeout', 10) + 10);

        try {
            $lock->block(3);
        } catch (LockTimeoutException) {
            return;
        }

        try {
            $yearsToSync = $this->holidayYearsNeedingSync($years);
            if ($yearsToSync === []) {
                return;
            }

            $this->holidaySync->sync($yearsToSync);
            PublicCache::bumpScheduleVersion();
        } catch (Throwable $exception) {
            report($exception);
        } finally {
            $lock->release();
        }
    }

    /**
     * @return array<int, int>
     */
    private function yearsForRange(Carbon $from, Carbon $to): array
    {
        return range($from->year, $to->year);
    }

    /**
     * @param  array<int, int>  $years
     * @return array<int, int>
     */
    private function holidayYearsNeedingSync(array $years): array
    {
        $freshAfter = now('Asia/Jakarta')->subHours((int) config('services.indonesian_holidays.auto_sync_fresh_hours', 12));

        return collect($years)
            ->filter(function (int $year) use ($freshAfter): bool {
                $lastSyncedAt = NationalHoliday::where('source', NationalHolidaySyncService::SOURCE)
                    ->where('year', $year)
                    ->max('synced_at');

                return ! $lastSyncedAt || Carbon::parse($lastSyncedAt, 'Asia/Jakarta')->lt($freshAfter);
            })
            ->values()
            ->all();
    }

    /**
     * @return array{type:string,name:string,label:string,tentative:bool}|null
     */
    private function defaultClosureFor(Carbon $date, ?NationalHoliday $holiday = null, bool $holidayLoaded = false): ?array
    {
        if (! $holidayLoaded) {
            $holiday = NationalHoliday::whereDate('date', $date->toDateString())->first();
        }

        if ($holiday) {
            return [
                'type' => $holiday->type,
                'name' => $holiday->name,
                'label' => $this->holidayClosureLabel($holiday),
                'tentative' => $holiday->tentative,
            ];
        }

        if ($this->isDefaultHoliday($date)) {
            return [
                'type' => 'operational_closed',
                'name' => 'Libur operasional',
                'label' => 'Libur operasional',
                'tentative' => false,
            ];
        }

        return null;
    }

    /**
     * @return array{type:string,name:string,label:string,tentative:bool,source:string,sourceUrl:string}|null
     */
    private function holidayPayload(?NationalHoliday $holiday): ?array
    {
        if (! $holiday) {
            return null;
        }

        return [
            'type' => $holiday->type,
            'name' => $holiday->name,
            'label' => $this->holidayClosureLabel($holiday),
            'tentative' => $holiday->tentative,
            'source' => $holiday->source,
            'sourceUrl' => $holiday->source_url,
        ];
    }

    private function holidayClosureLabel(NationalHoliday $holiday): string
    {
        $prefix = $holiday->type === NationalHoliday::TYPE_COLLECTIVE_LEAVE
            ? 'Cuti Bersama'
            : 'Libur Nasional';
        $name = $holiday->type === NationalHoliday::TYPE_COLLECTIVE_LEAVE
            ? trim((string) preg_replace('/^Cuti Bersama\s*/i', '', $holiday->name))
            : $holiday->name;

        return $prefix.': '.$name;
    }

    /**
     * @param  array{type:string,name:string,label:string,tentative:bool}|null  $defaultClosure
     * @return array{type:string,name:string,label:string,tentative:bool}|null
     */
    private function slotClosureReason(string $status, ?ScheduleOverride $override, ?array $defaultClosure): ?array
    {
        if ($status !== 'Closed') {
            return null;
        }

        if ($defaultClosure) {
            return $defaultClosure;
        }

        if ($override?->status === 'Closed') {
            return [
                'type' => 'manual_closed',
                'name' => 'Ditutup admin',
                'label' => 'Ditutup admin',
                'tentative' => false,
            ];
        }

        return null;
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
        $this->ensureHolidayDataForDate($date);
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

        return $this->defaultClosureFor($date) !== null ? 'Closed' : 'Available';
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
        $this->ensureHolidayDataForDate($date);
        $dateKey = $date->toDateString();
        $times = collect($times)->unique()->values();

        if ($times->isEmpty()) {
            return [];
        }

        $defaultStatus = $this->defaultClosureFor($date) !== null ? 'Closed' : 'Available';
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
