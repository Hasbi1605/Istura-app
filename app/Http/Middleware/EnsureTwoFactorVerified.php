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

        // No user or 2FA not enabled: pass through
        if (! $user || ! $user->two_factor_confirmed_at) {
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

        // 2FA required but not verified
        return response()->json([
            'message' => 'Verifikasi 2FA diperlukan.',
            'two_factor_required' => true,
        ], 403);
    }
}
