<?php

namespace App\Http\Middleware;

use App\Services\TwoFactorService;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureTwoFactorVerified
{
    public function __construct(private TwoFactorService $twoFactor) {}

    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (! $user) {
            return $next($request);
        }

        // 2FA not set up yet: block access and require setup
        if (! $user->two_factor_confirmed_at) {
            return response()->json([
                'message' => 'Anda harus mengaktifkan Two-Factor Authentication terlebih dahulu.',
                'two_factor_setup_required' => true,
            ], 403);
        }

        // If no session available (e.g. token-based auth in tests), skip session check
        if (! $request->hasSession()) {
            return $next($request);
        }

        // Already verified this session
        if ($request->session()->get('two_factor_verified')) {
            return $next($request);
        }

        // Device is trusted
        if ($this->twoFactor->isDeviceTrusted($user, $request)) {
            $request->session()->put('two_factor_verified', true);

            return $next($request);
        }

        // 2FA enabled but not verified this session
        return response()->json([
            'message' => 'Verifikasi 2FA diperlukan.',
            'two_factor_required' => true,
        ], 403);
    }
}
