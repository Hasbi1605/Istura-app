<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class AddSecurityHeaders
{
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        $response->headers->set('Content-Security-Policy', $this->buildCsp($request));

        if ($this->allowsSameOriginDocumentPreview($request)) {
            $response->headers->set('X-Frame-Options', 'SAMEORIGIN');
        } else {
            $response->headers->set('X-Frame-Options', 'DENY');
        }

        $response->headers->set('X-Content-Type-Options', 'nosniff');
        $response->headers->set('Referrer-Policy', 'strict-origin-when-cross-origin');
        $response->headers->set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

        if ($request->secure() || app()->environment('production')) {
            $response->headers->set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
        }

        return $response;
    }

    private function buildCsp(Request $request): string
    {
        $appUrl = config('app.url', '');
        $reverbHost = config('reverb.servers.reverb.options.host', '');
        $reverbPort = config('reverb.servers.reverb.options.port', '');
        $reverbScheme = config('reverb.servers.reverb.options.scheme', 'https') === 'https' ? 'wss' : 'ws';

        $connectSrc = "'self'";
        if ($reverbHost) {
            $connectSrc .= " {$reverbScheme}://{$reverbHost}".($reverbPort ? ":{$reverbPort}" : '');
        }

        $frameAncestors = $this->allowsSameOriginDocumentPreview($request) ? "'self'" : "'none'";

        $directives = [
            "default-src 'self'",
            "script-src 'self'",
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data: https:",
            "font-src 'self' data:",
            "connect-src {$connectSrc}",
            "frame-src 'self' https://www.youtube.com https://youtube.com https://www.youtube-nocookie.com",
            "frame-ancestors {$frameAncestors}",
            "base-uri 'self'",
            "form-action 'self'",
            "object-src 'none'",
        ];

        return implode('; ', $directives);
    }

    private function allowsSameOriginDocumentPreview(Request $request): bool
    {
        return $request->is('api/admin/bookings/*/document')
            && $request->query('disposition') === 'inline';
    }
}
