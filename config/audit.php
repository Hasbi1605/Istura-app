<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Retensi Riwayat Aktivitas
    |--------------------------------------------------------------------------
    |
    | Jumlah hari log audit dipertahankan. Entri yang lebih tua dari rentang
    | ini akan dihapus otomatis oleh command `audit:prune` yang dijadwalkan
    | harian. Set 0 untuk menonaktifkan pemangkasan otomatis.
    |
    */

    'retention_days' => (int) env('AUDIT_LOG_RETENTION_DAYS', 180),
];
