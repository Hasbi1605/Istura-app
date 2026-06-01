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
        $scriptSrc = "'self'";
        $connectSrc = "'self'";
        $fontSrc = "'self' data: https://fonts.gstatic.com";

        foreach ($this->reverbClientWebSocketUrls() as $reverbClientUrl) {
            $connectSrc .= " {$reverbClientUrl}";
        }

        $viteDevServerUrl = $this->viteDevServerUrl();
        if ($viteDevServerUrl) {
            $scriptSrc .= " 'unsafe-inline' {$viteDevServerUrl}";
            $connectSrc .= " {$viteDevServerUrl} ".$this->toWebSocketUrl($viteDevServerUrl);
            $fontSrc .= " {$viteDevServerUrl}";
        }

        $frameAncestors = $this->allowsSameOriginDocumentPreview($request) ? "'self'" : "'none'";

        $directives = [
            "default-src 'self'",
            "script-src {$scriptSrc}",
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
            "img-src 'self' data: https:",
            "font-src {$fontSrc}",
            "connect-src {$connectSrc}",
            "frame-src 'self' https://www.youtube.com https://youtube.com https://www.youtube-nocookie.com https://www.google.com https://maps.google.com https://www.google.com/maps",
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

    private function viteDevServerUrl(): ?string
    {
        if (! app()->environment('local')) {
            return null;
        }

        $hotFile = public_path('hot');
        if (! is_file($hotFile)) {
            return null;
        }

        $url = trim((string) file_get_contents($hotFile));

        return filter_var($url, FILTER_VALIDATE_URL) ? rtrim($url, '/') : null;
    }

    private function toWebSocketUrl(string $url): string
    {
        return preg_replace('/^http/', 'ws', $url, 1) ?? $url;
    }

    /**
     * @return array<int, string>
     */
    private function reverbClientWebSocketUrls(): array
    {
        $host = config('reverb.apps.apps.0.options.host');
        if (! $host) {
            return [];
        }

        $scheme = config('reverb.apps.apps.0.options.scheme', 'https') === 'https' ? 'wss' : 'ws';
        $fallbackScheme = $scheme === 'wss' ? 'ws' : 'wss';
        $port = config('reverb.apps.apps.0.options.port');
        $portSuffix = $port ? ":{$port}" : '';

        return [
            "{$scheme}://{$host}{$portSuffix}",
            "{$fallbackScheme}://{$host}{$portSuffix}",
        ];
    }
}
