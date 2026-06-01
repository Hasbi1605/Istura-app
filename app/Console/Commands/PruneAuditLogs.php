<?php

namespace App\Console\Commands;

use App\Models\AuditLog;
use Illuminate\Console\Command;

class PruneAuditLogs extends Command
{
    protected $signature = 'audit:prune {--days= : Override jumlah hari retensi}';

    protected $description = 'Hapus riwayat aktivitas yang lebih tua dari batas retensi.';

    public function handle(): int
    {
        $days = (int) ($this->option('days') ?? config('audit.retention_days', 180));

        if ($days <= 0) {
            $this->info('Retensi audit dinonaktifkan (days <= 0). Tidak ada yang dihapus.');

            return self::SUCCESS;
        }

        $cutoff = now()->subDays($days);

        $deleted = AuditLog::where('created_at', '<', $cutoff)->delete();

        $this->info("Menghapus {$deleted} entri riwayat aktivitas sebelum {$cutoff->toDateTimeString()}.");

        return self::SUCCESS;
    }
}
