<?php

namespace App\Services;

use App\Models\Booking;
use Carbon\Carbon;

/**
 * Generates booking codes in the same format used by the legacy app:
 * "ISTURA-{year}-{padded sequence}" e.g. ISTURA-2026-0042.
 */
class BookingCodeGenerator
{
    public function next(): string
    {
        $year = Carbon::now('Asia/Jakarta')->year;
        $prefix = "ISTURA-{$year}-";

        $latest = Booking::where('code', 'like', $prefix.'%')
            ->orderByDesc('code')
            ->first();

        $sequence = 1;
        if ($latest) {
            $tail = (int) substr($latest->code, strlen($prefix));
            $sequence = $tail + 1;
        }

        return $prefix.str_pad((string) $sequence, 4, '0', STR_PAD_LEFT);
    }

    public function token(): string
    {
        return 'fb_'.bin2hex(random_bytes(8));
    }
}
