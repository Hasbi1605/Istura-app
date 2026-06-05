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
        $imgSrc = "'self' data: blob:".$this->cspSourceList($this->publicImageHosts());

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
            "style-src 'self' https://fonts.googleapis.com",
            "style-src-attr 'unsafe-inline'",
            "img-src {$imgSrc}",
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
        $port = config('reverb.apps.apps.0.options.port');
        $portSuffix = $port ? ":{$port}" : '';

        $urls = ["{$scheme}://{$host}{$portSuffix}"];

        if (app()->environment('local')) {
            $fallbackScheme = $scheme === 'wss' ? 'ws' : 'wss';
            $urls[] = "{$fallbackScheme}://{$host}{$portSuffix}";
        }

        return array_values(array_unique($urls));
    }

    /**
     * @return array<int, string>
     */
    private function publicImageHosts(): array
    {
        return collect(config('security.public_image_hosts', []))
            ->map(fn (string $host) => strtolower(trim($host)))
            ->filter(fn (string $host) => $host !== '' && preg_match('/^[a-z0-9.-]+(?::[0-9]+)?$/', $host))
            ->map(fn (string $host) => "https://{$host}")
            ->values()
            ->all();
    }

    /**
     * @param  array<int, string>  $sources
     */
    private function cspSourceList(array $sources): string
    {
        if ($sources === []) {
            return '';
        }

        return ' '.implode(' ', $sources);
    }
}
