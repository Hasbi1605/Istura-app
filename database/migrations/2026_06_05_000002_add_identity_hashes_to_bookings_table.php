<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            $table->string('nik_hash', 64)->nullable()->after('nik_masked');
            $table->string('whatsapp_normalized', 32)->nullable()->after('whatsapp');
            $table->index('nik_hash', 'bookings_nik_hash_index');
            $table->index('whatsapp_normalized', 'bookings_whatsapp_normalized_index');
        });

        DB::table('bookings')
            ->orderBy('id')
            ->chunkById(100, function ($bookings): void {
                foreach ($bookings as $booking) {
                    $nik = null;
                    try {
                        $nik = $booking->nik_encrypted ? Crypt::decryptString($booking->nik_encrypted) : null;
                    } catch (Throwable) {
                        $nik = null;
                    }

                    DB::table('bookings')
                        ->where('id', $booking->id)
                        ->update([
                            'nik_hash' => $nik ? $this->identityHash($nik) : null,
                            'whatsapp_normalized' => $this->normalizeWhatsapp($booking->whatsapp),
                        ]);
                }
            });
    }

    public function down(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            $table->dropIndex('bookings_whatsapp_normalized_index');
            $table->dropIndex('bookings_nik_hash_index');
            $table->dropColumn(['nik_hash', 'whatsapp_normalized']);
        });
    }

    private function identityHash(string $value): string
    {
        return hash_hmac('sha256', $value, (string) config('app.key'));
    }

    private function normalizeWhatsapp(?string $value): ?string
    {
        if (! is_string($value) || $value === '') {
            return null;
        }

        if (str_starts_with($value, '08')) {
            return '62'.substr($value, 1);
        }

        return $value;
    }
};
