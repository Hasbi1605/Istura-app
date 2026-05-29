<?php

namespace App\Services;

use Carbon\Carbon;

/**
 * Helpers untuk format tanggal/jam Indonesia (mirror dari format.ts di App.tsx).
 */
class IndonesianDate
{
    public const MONTHS = [
        1 => 'Januari', 2 => 'Februari', 3 => 'Maret', 4 => 'April',
        5 => 'Mei', 6 => 'Juni', 7 => 'Juli', 8 => 'Agustus',
        9 => 'September', 10 => 'Oktober', 11 => 'November', 12 => 'Desember',
    ];

    public const DAYS = [
        0 => 'Minggu', 1 => 'Senin', 2 => 'Selasa', 3 => 'Rabu',
        4 => 'Kamis', 5 => 'Jumat', 6 => 'Sabtu',
    ];

    public static function longDate(Carbon $date): string
    {
        return self::DAYS[$date->dayOfWeek].', '.$date->day.' '.self::MONTHS[$date->month].' '.$date->year;
    }

    public static function submittedAt(Carbon $at): string
    {
        $local = $at->copy()->timezone('Asia/Jakarta');

        return $local->day.' '.self::MONTHS[$local->month].' '.$local->year.', '.$local->format('H.i').' WIB';
    }
}
