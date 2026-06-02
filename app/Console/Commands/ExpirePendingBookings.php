<?php

namespace App\Console\Commands;

use App\Services\BookingService;
use Illuminate\Console\Command;

class ExpirePendingBookings extends Command
{
    protected $signature = 'bookings:expire-pending';

    protected $description = 'Tandai booking pending yang jadwal kunjungannya sudah terlewat sebagai kedaluwarsa.';

    public function handle(BookingService $bookings): int
    {
        $expired = $bookings->expireStalePending();

        $this->info("Menandai {$expired} booking pending sebagai kedaluwarsa.");

        return self::SUCCESS;
    }
}
