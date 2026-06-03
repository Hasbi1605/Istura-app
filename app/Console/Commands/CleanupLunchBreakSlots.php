<?php

namespace App\Console\Commands;

use App\Models\Booking;
use App\Models\BookingSlot;
use App\Models\ScheduleOverride;
use App\Support\PublicCache;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class CleanupLunchBreakSlots extends Command
{
    protected $signature = 'schedule:cleanup-lunch-break {--force : Hapus data jam 12.00 tanpa prompt konfirmasi.}';

    protected $description = 'Hapus data test jam 12.00 dari booking, slot, override jadwal, dan slot lock.';

    public function handle(): int
    {
        $bookingIds = Booking::query()
            ->where('time', '12.00')
            ->pluck('id')
            ->merge(BookingSlot::query()->where('time', '12.00')->pluck('booking_id'))
            ->unique()
            ->values();

        $counts = [
            'bookings' => $bookingIds->count(),
            'booking_slots' => BookingSlot::query()->where('time', '12.00')->count(),
            'schedule_overrides' => ScheduleOverride::query()->where('time', '12.00')->count(),
            'booking_slot_locks' => DB::table('booking_slot_locks')->where('slot_key', 'like', '%|12.00')->count(),
        ];

        $this->components->info(sprintf(
            'Data jam 12.00: %d booking, %d booking slot, %d override jadwal, %d slot lock.',
            $counts['bookings'],
            $counts['booking_slots'],
            $counts['schedule_overrides'],
            $counts['booking_slot_locks'],
        ));

        if (array_sum($counts) === 0) {
            PublicCache::bumpScheduleVersion();
            $this->components->info('Tidak ada data jam 12.00 yang perlu dihapus. Cache jadwal publik tetap dibersihkan.');

            return self::SUCCESS;
        }

        if (! $this->option('force') && ! $this->confirm('Hapus semua data test jam 12.00?')) {
            $this->components->warn('Cleanup dibatalkan.');

            return self::FAILURE;
        }

        $deleted = DB::transaction(function () use ($bookingIds): array {
            $deletedBookings = $bookingIds->isEmpty()
                ? 0
                : Booking::query()->whereKey($bookingIds->all())->delete();

            $deletedSlots = BookingSlot::query()->where('time', '12.00')->delete();
            $deletedOverrides = ScheduleOverride::query()->where('time', '12.00')->delete();
            $deletedLocks = DB::table('booking_slot_locks')->where('slot_key', 'like', '%|12.00')->delete();

            return [
                'bookings' => $deletedBookings,
                'booking_slots' => $deletedSlots,
                'schedule_overrides' => $deletedOverrides,
                'booking_slot_locks' => $deletedLocks,
            ];
        });

        PublicCache::bumpScheduleVersion();

        $this->components->info(sprintf(
            'Cleanup selesai: %d booking, %d booking slot sisa, %d override jadwal, %d slot lock dihapus.',
            $deleted['bookings'],
            $deleted['booking_slots'],
            $deleted['schedule_overrides'],
            $deleted['booking_slot_locks'],
        ));

        return self::SUCCESS;
    }
}
