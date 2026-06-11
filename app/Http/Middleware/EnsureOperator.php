<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureOperator
{
    public function handle(Request $request, Closure $next): Response
    {
        abort_unless($request->user()?->isOperator(), 403, 'Viewer tidak memiliki izin untuk melakukan aksi ini.');

        return $next($request);
    }
}
