<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Pangkas riwayat aktivitas lama agar tabel audit tetap ringan.
Schedule::command('audit:prune')->dailyAt('03:00');
Schedule::command('bookings:expire-pending')->everyFiveMinutes();
