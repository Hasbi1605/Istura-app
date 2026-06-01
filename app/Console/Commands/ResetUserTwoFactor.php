<?php

namespace App\Console\Commands;

use App\Models\User;
use App\Services\AuditLogger;
use App\Services\TwoFactorService;
use Illuminate\Console\Command;

class ResetUserTwoFactor extends Command
{
    protected $signature = 'user:reset-2fa {email : Email akun yang 2FA-nya akan direset} {--force : Lewati konfirmasi interaktif}';

    protected $description = 'Reset 2FA pengguna saat authenticator dan recovery code tidak tersedia.';

    public function handle(TwoFactorService $twoFactor): int
    {
        $email = strtolower(trim((string) $this->argument('email')));
        $user = User::where('email', $email)->first();

        if (! $user) {
            $this->error("Pengguna {$email} tidak ditemukan.");

            return self::FAILURE;
        }

        if (! $this->option('force') && ! $this->confirm("Reset 2FA untuk {$user->email}? User wajib setup QR baru saat login berikutnya.")) {
            $this->info('Reset 2FA dibatalkan.');

            return self::SUCCESS;
        }

        $user->forceFill([
            'two_factor_secret' => null,
            'two_factor_recovery_codes' => null,
            'two_factor_confirmed_at' => null,
        ])->save();

        $twoFactor->revokeAllDevices($user);

        AuditLogger::record(null, 'Mereset Two-Factor Authentication via CLI', User::class, $user->id, [
            'email' => $user->email,
        ]);

        $this->info("2FA {$user->email} sudah direset. User wajib setup 2FA ulang pada login berikutnya.");

        return self::SUCCESS;
    }
}
