<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

class EnsureAdmin
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

        abort_unless($request->user()?->isAdmin(), 403, 'Hanya Admin yang dapat mengakses area ini.');

        return $next($request);
    }
}
