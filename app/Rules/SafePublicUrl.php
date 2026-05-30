<?php

namespace App\Rules;

use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

class SafePublicUrl implements ValidationRule
{
    /**
     * @param  array<int, string>  $schemes
     * @param  array<int, string>  $hosts
     */
    public function __construct(
        private readonly array $schemes = ['https'],
        private readonly array $hosts = [],
        private readonly bool $allowRelative = true,
        private readonly bool $allowFragment = false,
    ) {}

    public static function link(): self
    {
        return new self(['https', 'mailto', 'tel'], allowRelative: true, allowFragment: true);
    }

    public static function image(): self
    {
        return new self(['https'], allowRelative: true);
    }

    public static function youtube(): self
    {
        return new self(['https'], ['youtube.com', 'www.youtube.com', 'youtu.be', 'www.youtube-nocookie.com'], false);
    }

    public static function mapLink(): self
    {
        return new self(['https'], ['maps.app.goo.gl', 'www.google.com', 'google.com', 'maps.google.com'], false);
    }

    public static function mapEmbed(): self
    {
        return new self(['https'], ['www.google.com', 'maps.google.com'], false);
    }

    public static function navTarget(): self
    {
        return new self(['https'], allowRelative: true, allowFragment: true);
    }

    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        if (! is_string($value)) {
            $fail('URL tidak valid.');

            return;
        }

        $url = trim($value);
        if ($url === '' || preg_match('/[\x00-\x1F\x7F]/', $url)) {
            $fail('URL tidak valid.');

            return;
        }

        if ($this->allowFragment && str_starts_with($url, '#')) {
            if (preg_match('/^#[A-Za-z][A-Za-z0-9_-]*$/', $url)) {
                return;
            }

            $fail('Target halaman tidak valid.');

            return;
        }

        if ($this->allowRelative && $this->isRelativePath($url)) {
            return;
        }

        $parts = parse_url($url);
        if (! is_array($parts) || empty($parts['scheme'])) {
            $fail('URL harus memakai skema yang diizinkan.');

            return;
        }

        $scheme = strtolower((string) $parts['scheme']);
        if (! in_array($scheme, $this->schemes, true)) {
            $fail('Skema URL tidak diizinkan.');

            return;
        }

        if ($scheme === 'mailto' || $scheme === 'tel') {
            return;
        }

        $host = strtolower((string) ($parts['host'] ?? ''));
        if ($host === '') {
            $fail('Host URL wajib diisi.');

            return;
        }

        if ($this->hosts !== [] && ! in_array($host, $this->hosts, true)) {
            $fail('Domain URL tidak diizinkan.');
        }
    }

    private function isRelativePath(string $url): bool
    {
        if ($url === 'home') {
            return true;
        }

        if (! str_starts_with($url, '/') || str_starts_with($url, '//')) {
            return false;
        }

        return ! str_contains($url, '\\') && ! preg_match('/(?:^|\/)\.\.?(?:\/|$)/', $url);
    }
}
