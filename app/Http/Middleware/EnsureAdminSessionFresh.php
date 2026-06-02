<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

class EnsureAdminSessionFresh
{
    public function handle(Request $request, Closure $next): Response
    {
        if (! $request->user()) {
            return $next($request);
        }

        if (! $request->hasSession()) {
            return response()->json([
                'message' => 'Sesi admin diperlukan. Silakan login kembali.',
            ], 401);
        }

        $startedAt = (int) $request->session()->get('admin_session_started_at', 0);
        if ($startedAt <= 0) {
            $request->session()->put('admin_session_started_at', now()->timestamp);

            return $next($request);
        }

        $absoluteLifetime = max(1, (int) config('session.admin_absolute_lifetime', 720));
        if ((now()->timestamp - $startedAt) <= $absoluteLifetime * 60) {
            return $next($request);
        }

        Auth::guard('web')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return response()->json([
            'message' => 'Sesi admin sudah melewati batas waktu maksimum. Silakan login kembali.',
        ], 401);
    }
}
