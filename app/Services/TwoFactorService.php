<?php

namespace App\Services;

use App\Models\TrustedDevice;
use App\Models\User;
use BaconQrCode\Renderer\Image\SvgImageBackEnd;
use BaconQrCode\Renderer\ImageRenderer;
use BaconQrCode\Renderer\RendererStyle\RendererStyle;
use BaconQrCode\Writer;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use PragmaRX\Google2FA\Google2FA;

class TwoFactorService
{
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

    /**
     * Check if a device is trusted for the user.
     */
    public function isDeviceTrusted(User $user, Request $request): bool
    {
        $deviceHash = $this->getDeviceHash($request);

        return TrustedDevice::where('user_id', $user->id)
            ->where('device_hash', $deviceHash)
            ->where('trusted_until', '>', now())
            ->exists();
    }

    /**
     * Trust the current device for N days.
     */
    public function trustDevice(User $user, Request $request, int $days = 30): void
    {
        $deviceHash = $this->getDeviceHash($request);
        $deviceName = $this->getDeviceName($request);

        TrustedDevice::updateOrCreate(
            ['user_id' => $user->id, 'device_hash' => $deviceHash],
            ['device_name' => $deviceName, 'trusted_until' => now()->addDays($days)],
        );

        // Cleanup expired devices
        TrustedDevice::where('user_id', $user->id)
            ->where('trusted_until', '<', now())
            ->delete();
    }

    /**
     * Revoke all trusted devices for the user.
     */
    public function revokeAllDevices(User $user): void
    {
        TrustedDevice::where('user_id', $user->id)->delete();
    }

    /**
     * Generate a unique hash for the current device/browser.
     */
    private function getDeviceHash(Request $request): string
    {
        $fingerprint = implode('|', [
            $request->ip(),
            $request->userAgent(),
        ]);

        return hash('sha256', $fingerprint);
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
