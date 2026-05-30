<?php

namespace App\Services;

use App\Models\Booking;
use Carbon\Carbon;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;

/**
 * Generates booking codes in the format "ISTURA-{year}-{padded sequence}".
 * The first booking in a year starts from 0000, then 0001, 0002, and so on.
 */
class BookingCodeGenerator
{
    private const FIRST_SEQUENCE = 0;

    private const SEQUENCE_WIDTH = 4;

    public function next(): string
    {
        $year = Carbon::now('Asia/Jakarta')->year;
        $prefix = "ISTURA-{$year}-";

        for ($attempt = 0; $attempt < 3; $attempt++) {
            try {
                $sequence = DB::transaction(function () use ($year, $prefix): int {
                    $row = DB::table('booking_sequences')
                        ->where('year', $year)
                        ->lockForUpdate()
                        ->first();

                    if (! $row) {
                        $current = $this->nextSequenceAfterExistingBookings($prefix);
                        DB::table('booking_sequences')->insert([
                            'year' => $year,
                            'next_sequence' => $current + 1,
                            'created_at' => now(),
                            'updated_at' => now(),
                        ]);

                        return $current;
                    }

                    $current = (int) $row->next_sequence;
                    DB::table('booking_sequences')
                        ->where('year', $year)
                        ->update([
                            'next_sequence' => $current + 1,
                            'updated_at' => now(),
                        ]);

                    return $current;
                });

                return $prefix.str_pad((string) $sequence, self::SEQUENCE_WIDTH, '0', STR_PAD_LEFT);
            } catch (QueryException $exception) {
                if (! $this->isSequenceInsertRace($exception) || $attempt === 2) {
                    throw $exception;
                }
            }
        }

        throw new \RuntimeException('Gagal membuat kode booking.');
    }

    private function nextSequenceAfterExistingBookings(string $prefix): int
    {
        $latestSequence = Booking::where('code', 'like', $prefix.'%')
            ->pluck('code')
            ->map(fn (string $code): int => (int) substr($code, strlen($prefix)))
            ->max();

        return $latestSequence === null
            ? self::FIRST_SEQUENCE
            : $latestSequence + 1;
    }

    private function isSequenceInsertRace(QueryException $exception): bool
    {
        return in_array((string) $exception->getCode(), ['23000', '23505'], true);
    }

    public function token(): string
    {
        return 'fb_'.bin2hex(random_bytes(8));
    }
}
