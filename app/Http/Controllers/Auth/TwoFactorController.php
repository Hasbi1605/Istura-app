<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\AuditLogger;
use App\Services\TwoFactorService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class TwoFactorController extends Controller
{
    public function __construct(private TwoFactorService $twoFactor) {}

    /**
     * Begin 2FA setup: generate secret + QR code.
     */
    public function setup(Request $request): JsonResponse
    {
        $user = $request->user();

        if ($user->two_factor_confirmed_at) {
            return response()->json(['message' => '2FA sudah aktif.'], 409);
        }

        $secret = $this->twoFactor->generateSecret();

        // Store unconfirmed secret until the user proves the authenticator works.
        $user->forceFill(['two_factor_secret' => encrypt($secret)])->save();

        $qrUri = $this->twoFactor->getQrCodeUri($user, $secret);
        $qrSvg = $this->twoFactor->getQrCodeSvg($qrUri);

        return response()->json([
            'secret' => $secret,
            'qr_svg' => $qrSvg,
        ]);
    }

    /**
     * Confirm 2FA setup with a valid TOTP code.
     */
    public function confirm(Request $request): JsonResponse
    {
        $request->validate([
            'code' => ['required', 'string', 'size:6'],
        ]);

        $user = $request->user();

        if ($user->two_factor_confirmed_at) {
            return response()->json(['message' => '2FA sudah aktif.'], 409);
        }

        if (! $user->two_factor_secret) {
            return response()->json(['message' => 'Belum ada setup 2FA. Mulai dari awal.'], 422);
        }

        $secret = decrypt($user->two_factor_secret);

        if (! $this->twoFactor->verify($secret, $request->input('code'))) {
            throw ValidationException::withMessages([
                'code' => ['Kode OTP tidak valid. Pastikan waktu perangkat Anda sinkron.'],
            ]);
        }

        $recoveryCodes = $this->twoFactor->generateRecoveryCodes();

        $user->forceFill([
            'two_factor_recovery_codes' => encrypt(json_encode($this->twoFactor->hashRecoveryCodes($recoveryCodes))),
            'two_factor_confirmed_at' => now(),
        ])->save();

        if ($request->hasSession()) {
            $request->session()->put('two_factor_verified', true);
        }

        AuditLogger::record($user, 'Mengaktifkan Two-Factor Authentication', User::class, $user->id);

        return response()->json([
            'recovery_codes' => $recoveryCodes,
        ]);
    }

    /**
     * Verify 2FA during login (after password auth succeeds).
     */
    public function verify(Request $request): JsonResponse
    {
        $request->validate([
            'code' => ['required', 'string'],
            'trust_device' => ['sometimes', 'boolean'],
        ]);

        $user = $request->user();

        if (! $user || ! $user->two_factor_confirmed_at) {
            return response()->json(['message' => '2FA tidak aktif.'], 422);
        }

        $code = $request->input('code');
        $secret = decrypt($user->two_factor_secret);

        // Try TOTP code first
        $valid = $this->twoFactor->verify($secret, $code);

        // Try recovery code if TOTP fails
        if (! $valid) {
            $valid = $this->twoFactor->useRecoveryCode($user, $code);
        }

        if (! $valid) {
            throw ValidationException::withMessages([
                'code' => ['Kode verifikasi tidak valid.'],
            ]);
        }

        // Mark session as 2FA verified when the request uses browser session auth.
        if ($request->hasSession()) {
            $request->session()->put('two_factor_verified', true);
        }

        $trustedCookie = null;

        // Trust device if requested
        if ($request->boolean('trust_device')) {
            $trustedCookie = $this->twoFactor->trustDevice($user, $request, 30);
        }

        $response = response()->json(['ok' => true]);

        return $trustedCookie ? $response->withCookie($trustedCookie) : $response;
    }

    /**
     * Disable 2FA (requires current password and fresh 2FA proof).
     */
    public function disable(Request $request): JsonResponse
    {
        $request->validate([
            'password' => ['required', 'string'],
            'code' => ['required', 'string'],
        ]);

        $user = $request->user();

        if (! $user->two_factor_confirmed_at) {
            return response()->json(['message' => '2FA belum aktif.'], 422);
        }

        $this->ensureCurrentPassword($request, $user);
        $this->ensureFreshTwoFactorProof($request, $user);

        $user->forceFill([
            'two_factor_secret' => null,
            'two_factor_recovery_codes' => null,
            'two_factor_confirmed_at' => null,
        ])->save();

        $this->twoFactor->revokeAllDevices($user);
        $forgetTrustedDeviceCookie = $this->twoFactor->forgetTrustedDeviceCookie();

        // Clear 2FA session flag when the request uses browser session auth.
        if ($request->hasSession()) {
            $request->session()->forget('two_factor_verified');
        }

        AuditLogger::record($user, 'Menonaktifkan Two-Factor Authentication', User::class, $user->id);

        return response()->json(['ok' => true])->withCookie($forgetTrustedDeviceCookie);
    }

    /**
     * Get current 2FA status.
     */
    public function status(Request $request): JsonResponse
    {
        $user = $request->user();

        return response()->json([
            'enabled' => $user->two_factor_confirmed_at !== null,
            'confirmed_at' => $user->two_factor_confirmed_at?->toIso8601String(),
        ]);
    }

    /**
     * Regenerate recovery codes (requires current password and fresh 2FA proof).
     */
    public function regenerateRecoveryCodes(Request $request): JsonResponse
    {
        $request->validate([
            'password' => ['required', 'string'],
            'code' => ['required', 'string'],
        ]);

        $user = $request->user();

        if (! $user->two_factor_confirmed_at) {
            return response()->json(['message' => '2FA belum aktif.'], 422);
        }

        $this->ensureCurrentPassword($request, $user);
        $this->ensureFreshTwoFactorProof($request, $user);

        $recoveryCodes = $this->twoFactor->generateRecoveryCodes();
        $user->forceFill([
            'two_factor_recovery_codes' => encrypt(json_encode($this->twoFactor->hashRecoveryCodes($recoveryCodes))),
        ])->save();

        AuditLogger::record($user, 'Memperbarui recovery codes 2FA', User::class, $user->id);

        return response()->json([
            'recovery_codes' => $recoveryCodes,
        ]);
    }

    /**
     * Check if the current session needs 2FA verification.
     */
    public function challenge(Request $request): JsonResponse
    {
        $user = $request->user();

        if (! $user || ! $request->hasSession()) {
            return response()->json(['requires_2fa' => false]);
        }

        $requires2fa = $user->two_factor_confirmed_at
            && ! $request->session()->get('two_factor_verified')
            && ! $this->twoFactor->isDeviceTrusted($user, $request);

        return response()->json(['requires_2fa' => $requires2fa]);
    }

    private function ensureCurrentPassword(Request $request, User $user): void
    {
        if (! Hash::check($request->input('password'), $user->password)) {
            throw ValidationException::withMessages([
                'password' => ['Password tidak cocok.'],
            ]);
        }
    }

    private function ensureFreshTwoFactorProof(Request $request, User $user): void
    {
        if (! $user->two_factor_secret) {
            throw ValidationException::withMessages([
                'code' => ['2FA belum aktif.'],
            ]);
        }

        $code = $request->input('code');
        $secret = decrypt($user->two_factor_secret);
        $valid = $this->twoFactor->verify($secret, $code);

        if (! $valid) {
            $valid = $this->twoFactor->useRecoveryCode($user, $code);
        }

        if (! $valid) {
            throw ValidationException::withMessages([
                'code' => ['Kode verifikasi tidak valid.'],
            ]);
        }
    }
}
