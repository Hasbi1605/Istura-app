<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Support\Facades\Auth;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureSuperAdmin
{
    public function handle(Request $request, Closure $next): Response
    {
        if ($request->user() && ! $request->user()->isActive()) {
            Auth::guard('web')->logout();
            if ($request->hasSession()) {
                $request->session()->invalidate();
            }
            abort(403, 'Akun ini sedang nonaktif.');
        }

        abort_unless($request->user()?->isSuperAdmin(), 403, 'Hanya Super Admin yang dapat mengakses area ini.');

        return $next($request);
    }
}
