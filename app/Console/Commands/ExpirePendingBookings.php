<?php

namespace App\Console\Commands;

use App\Services\BookingService;
use Illuminate\Console\Command;

class ExpirePendingBookings extends Command
{
    protected $signature = 'bookings:expire-pending';

    protected $description = 'Tandai booking pending dan usulan reschedule yang jadwalnya sudah terlewat.';

    public function handle(BookingService $bookings): int
    {
        $expiredPending = $bookings->expireStalePending();
        $expiredReschedules = $bookings->expireStaleReschedules();

        $this->info("Menandai {$expiredPending} booking pending sebagai kedaluwarsa.");
        $this->info("Menandai {$expiredReschedules} usulan reschedule sebagai kedaluwarsa.");

        return self::SUCCESS;
    }
}
