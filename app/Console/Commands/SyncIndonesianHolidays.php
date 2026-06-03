<?php

namespace App\Console\Commands;

use App\Models\NationalHoliday;
use App\Services\AuditLogger;
use App\Services\NationalHolidaySyncService;
use App\Support\PublicCache;
use Illuminate\Console\Command;

class SyncIndonesianHolidays extends Command
{
    protected $signature = 'holidays:sync-id {--year=* : Tahun yang disinkronkan. Default tahun ini dan tahun depan.}';

    protected $description = 'Sinkronisasi otomatis tanggal merah Indonesia dari provider eksternal ke database lokal.';

    public function handle(NationalHolidaySyncService $service): int
    {
        $years = $this->option('year');

        try {
            $result = $service->sync($years === [] ? null : $years);
        } catch (\Throwable $exception) {
            $this->error('Gagal sinkronisasi tanggal merah Indonesia: '.$exception->getMessage());

            return self::FAILURE;
        }

        // Deploys can rerun sync with unchanged holiday rows while public
        // schedule payloads are still stale, so refresh the cache on every
        // successful sync.
        PublicCache::bumpScheduleVersion();

        if ($result['created'] > 0 || $result['updated'] > 0 || $result['deleted'] > 0 || $result['conflicts'] !== []) {
            AuditLogger::record(null, 'Sinkronisasi tanggal merah Indonesia', NationalHoliday::class, null, $result);
        }

        $this->info(sprintf(
            'Tanggal merah sinkron: %d baru, %d berubah, %d dihapus.',
            $result['created'],
            $result['updated'],
            $result['deleted'],
        ));

        if ($result['missingYears'] !== []) {
            $this->warn('Provider belum punya data tahun: '.implode(', ', $result['missingYears']).'. Data lokal lama tetap dipakai jika ada.');
        }

        foreach ($result['conflicts'] as $conflict) {
            $this->warn("Ada {$conflict['count']} booking aktif pada tanggal merah {$conflict['date']}.");
        }

        return self::SUCCESS;
    }
}
