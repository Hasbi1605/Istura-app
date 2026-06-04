<?php

namespace App\Services;

use App\Models\TrustedDevice;
use App\Models\User;
use BaconQrCode\Renderer\Image\SvgImageBackEnd;
use BaconQrCode\Renderer\ImageRenderer;
use BaconQrCode\Renderer\RendererStyle\RendererStyle;
use BaconQrCode\Writer;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use PragmaRX\Google2FA\Google2FA;
use Symfony\Component\HttpFoundation\Cookie;

class TwoFactorService
{
    public const TRUSTED_DEVICE_COOKIE = 'istura_trusted_device';

    public const VERIFIED_USER_ID_SESSION_KEY = 'two_factor_verified_user_id';

    private const LEGACY_VERIFIED_SESSION_KEY = 'two_factor_verified';

    private Google2FA $engine;

    public function __construct()
    {
        $this->engine = new Google2FA;
    }

    /**
     * Generate a new 2FA secret for the user.
     */
    public function generateSecret(): string
    {
        return $this->engine->generateSecretKey(32);
    }

    /**
     * Get the provisioning URI for QR code generation.
     */
    public function getQrCodeUri(User $user, string $secret): string
    {
        return $this->engine->getQRCodeUrl(
            config('app.name', 'ISTURA'),
            $user->email,
            $secret,
        );
    }

    /**
     * Verify a TOTP code against the user's secret.
     */
    public function verify(string $secret, string $code): bool
    {
        return $this->engine->verifyKey($secret, $code);
    }

    /**
     * Generate recovery codes.
     */
    public function generateRecoveryCodes(int $count = 8): array
    {
        return collect(range(1, $count))
            ->map(fn () => Str::upper(Str::random(4).'-'.Str::random(4)))
            ->all();
    }

    public function hashRecoveryCodes(array $codes): array
    {
        return array_map(fn (string $code) => Hash::make($this->normalizeRecoveryCode($code)), $codes);
    }

    public function useRecoveryCode(User $user, string $code): bool
    {
        if (! $user->two_factor_recovery_codes) {
            return false;
        }

        $codes = json_decode(decrypt($user->two_factor_recovery_codes), true);
        if (! is_array($codes)) {
            return false;
        }

        $normalizedCode = $this->normalizeRecoveryCode($code);

        foreach ($codes as $index => $storedCode) {
            if (! is_string($storedCode) || ! $this->recoveryCodeMatches($normalizedCode, $storedCode)) {
                continue;
            }

            unset($codes[$index]);
            $user->forceFill([
                'two_factor_recovery_codes' => encrypt(json_encode($this->rehashPlainRecoveryCodes(array_values($codes)))),
            ])->save();

            return true;
        }

        return false;
    }

    /**
     * Check if a device is trusted for the user.
     */
    public function isDeviceTrusted(User $user, Request $request): bool
    {
        $token = $request->cookie(self::TRUSTED_DEVICE_COOKIE);
        if (! is_string($token) || ! $this->isValidTrustedDeviceToken($token)) {
            return false;
        }

        return TrustedDevice::where('user_id', $user->id)
            ->where('device_hash', $this->hashTrustedDeviceToken($token))
            ->where('trusted_until', '>', now())
            ->exists();
    }

    public function isSessionVerified(User $user, Request $request): bool
    {
        if (! $request->hasSession()) {
            return false;
        }

        $verifiedUserId = $request->session()->get(self::VERIFIED_USER_ID_SESSION_KEY);

        return $verifiedUserId !== null
            && (string) $verifiedUserId === (string) $user->getAuthIdentifier();
    }

    public function markSessionVerified(User $user, Request $request): void
    {
        if (! $request->hasSession()) {
            return;
        }

        $request->session()->forget(self::LEGACY_VERIFIED_SESSION_KEY);
        $request->session()->put(self::VERIFIED_USER_ID_SESSION_KEY, $user->getAuthIdentifier());
    }

    public function clearSessionVerification(Request $request): void
    {
        if (! $request->hasSession()) {
            return;
        }

        $request->session()->forget([
            self::VERIFIED_USER_ID_SESSION_KEY,
            self::LEGACY_VERIFIED_SESSION_KEY,
        ]);
    }

    /**
     * Trust the current device for N days.
     */
    public function trustDevice(User $user, Request $request, int $days = 30): Cookie
    {
        $token = Str::random(64);
        $deviceHash = $this->hashTrustedDeviceToken($token);
        $deviceName = $this->getDeviceName($request);

        TrustedDevice::updateOrCreate(
            ['user_id' => $user->id, 'device_hash' => $deviceHash],
            ['device_name' => $deviceName, 'trusted_until' => now()->addDays($days)],
        );

        // Cleanup expired devices
        TrustedDevice::where('user_id', $user->id)
            ->where('trusted_until', '<', now())
            ->delete();

        return cookie(
            self::TRUSTED_DEVICE_COOKIE,
            $token,
            $days * 24 * 60,
            '/',
            config('session.domain'),
            config('session.secure'),
            true,
            false,
            config('session.same_site', 'lax'),
        );
    }

    /**
     * Revoke all trusted devices for the user.
     */
    public function revokeAllDevices(User $user): void
    {
        TrustedDevice::where('user_id', $user->id)->delete();
    }

    public function forgetTrustedDeviceCookie(): Cookie
    {
        return cookie()->forget(self::TRUSTED_DEVICE_COOKIE, '/', config('session.domain'));
    }

    public function hashTrustedDeviceToken(string $token): string
    {
        return hash('sha256', $token);
    }

    private function isValidTrustedDeviceToken(string $token): bool
    {
        return strlen($token) >= 64 && preg_match('/^[A-Za-z0-9]+$/', $token) === 1;
    }

    private function normalizeRecoveryCode(string $code): string
    {
        return Str::upper(trim($code));
    }

    private function recoveryCodeMatches(string $code, string $storedCode): bool
    {
        if (str_starts_with($storedCode, '$2y$') || str_starts_with($storedCode, '$argon2')) {
            return Hash::check($code, $storedCode);
        }

        return hash_equals($this->normalizeRecoveryCode($storedCode), $code);
    }

    private function rehashPlainRecoveryCodes(array $codes): array
    {
        return array_values(array_filter(array_map(function (mixed $storedCode): ?string {
            if (! is_string($storedCode)) {
                return null;
            }

            if (str_starts_with($storedCode, '$2y$') || str_starts_with($storedCode, '$argon2')) {
                return $storedCode;
            }

            return Hash::make($this->normalizeRecoveryCode($storedCode));
        }, $codes)));
    }

    /**
     * Attempt to identify the device name from user agent.
     */
    private function getDeviceName(Request $request): string
    {
        $ua = $request->userAgent() ?? 'Unknown';
        // Simple extraction
        if (str_contains($ua, 'Chrome')) {
            return 'Chrome';
        }
        if (str_contains($ua, 'Firefox')) {
            return 'Firefox';
        }
        if (str_contains($ua, 'Safari')) {
            return 'Safari';
        }
        if (str_contains($ua, 'Edge')) {
            return 'Edge';
        }

        return Str::limit($ua, 50);
    }

    /**
     * Generate a QR code as SVG string.
     */
    public function getQrCodeSvg(string $uri): string
    {
        $renderer = new SvgImageBackEnd;
        $imageRenderer = new ImageRenderer(
            new RendererStyle(200),
            $renderer,
        );
        $writer = new Writer($imageRenderer);

        return $writer->writeString($uri);
    }
}
