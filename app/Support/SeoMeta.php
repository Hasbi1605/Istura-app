<?php

namespace App\Support;

use App\Models\Faq;
use App\Models\SiteSetting;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;

class SeoMeta
{
    public const HOME_TITLE = 'ISTURA Yogyakarta - Booking Kunjungan Istana Kepresidenan Gedung Agung';

    public const HOME_DESCRIPTION = 'Daftar kunjungan ISTURA Gedung Agung Yogyakarta secara online. Cek jadwal, syarat surat permohonan, tata tertib, dan konfirmasi WhatsApp.';

    /**
     * @return array<string, mixed>
     */
    public static function homePageViewData(): array
    {
        $hero = self::heroData();
        $siteContent = self::siteContentData();
        $faqs = self::faqData();
        $homeUrl = self::url('/');
        $ogImage = self::assetUrl('/assets/istura-home-preview.jpg');

        $seo = [
            'title' => self::HOME_TITLE,
            'description' => self::HOME_DESCRIPTION,
            'canonicalUrl' => $homeUrl,
            'siteName' => 'ISTURA',
            'image' => $ogImage,
            'imageAlt' => 'Booking kunjungan ISTURA Gedung Agung Yogyakarta',
            'imageWidth' => 1200,
            'imageHeight' => 630,
            'imageType' => 'image/jpeg',
        ];

        return [
            'seo' => $seo,
            'seoContent' => self::crawlerContent($hero, $siteContent, $faqs),
            'structuredDataJson' => self::structuredDataJson($seo, $siteContent, $faqs),
        ];
    }

    public static function canonicalRedirect(Request $request): ?RedirectResponse
    {
        if (! config('seo.redirect_to_canonical')) {
            return null;
        }

        $host = strtolower((string) $request->getHost());
        $canonicalHost = strtolower((string) config('seo.canonical_host'));
        $redirectHosts = array_map('strtolower', config('seo.redirect_hosts', []));

        if ($host === $canonicalHost || ! in_array($host, $redirectHosts, true)) {
            return null;
        }

        $target = self::url($request->getRequestUri());

        return redirect()->away($target, 301);
    }

    public static function robotsTxt(): string
    {
        return implode("\n", [
            '# ISTURA allows search indexing and AI answer grounding. Content-Signal records a no-training preference where honored.',
            '',
            'User-agent: *',
            'Content-Signal: search=yes,ai-input=yes,ai-train=no',
            'Allow: /',
            '',
            '# AI search / real-time retrieval / Gemini grounding crawlers.',
            'User-agent: OAI-SearchBot',
            'Allow: /',
            '',
            'User-agent: ChatGPT-User',
            'Allow: /',
            '',
            'User-agent: PerplexityBot',
            'Allow: /',
            '',
            'User-agent: Google-Extended',
            'Allow: /',
            '',
            '# AI training-only / bulk model-building crawlers.',
            'User-agent: GPTBot',
            'Disallow: /',
            '',
            'User-agent: CCBot',
            'Disallow: /',
            '',
            'User-agent: Bytespider',
            'Disallow: /',
            '',
            'User-agent: Applebot-Extended',
            'Disallow: /',
            '',
            'Sitemap: '.self::url('/sitemap.xml'),
            '',
        ]);
    }

    public static function sitemapXml(): string
    {
        $entries = [
            [
                'loc' => self::url('/'),
                'lastmod' => now('Asia/Jakarta')->toDateString(),
                'changefreq' => 'daily',
                'priority' => '1.0',
            ],
            [
                'loc' => self::url('/info/alur-kunjungan'),
                'lastmod' => now('Asia/Jakarta')->toDateString(),
                'changefreq' => 'monthly',
                'priority' => '0.8',
            ],
        ];

        $urls = collect($entries)
            ->map(fn (array $entry): string => sprintf(
                "    <url>\n        <loc>%s</loc>\n        <lastmod>%s</lastmod>\n        <changefreq>%s</changefreq>\n        <priority>%s</priority>\n    </url>",
                self::xml($entry['loc']),
                self::xml($entry['lastmod']),
                self::xml($entry['changefreq']),
                self::xml($entry['priority']),
            ))
            ->implode("\n");

        return "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n".
            "<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">\n".
            "{$urls}\n".
            "</urlset>\n";
    }

    public static function url(string $path = '/'): string
    {
        $root = rtrim((string) config('seo.canonical_url'), '/');
        $path = $path === '' ? '/' : $path;

        if (str_starts_with($path, '?')) {
            return $root.'/'.$path;
        }

        $path = '/'.ltrim($path, '/');

        return $path === '/' ? "{$root}/" : "{$root}{$path}";
    }

    public static function assetUrl(string $path): string
    {
        return self::url($path);
    }

    /**
     * @return array<string, mixed>
     */
    private static function heroData(): array
    {
        $default = [
            'headline' => 'ISTURA - Istana Untuk Rakyat',
            'subheadline' => 'Booking Kunjungan Istana Kepresidenan Yogyakarta',
            'primaryCta' => 'Mulai Booking',
            'secondaryCta' => 'Cek Jadwal',
            'story' => 'Pilih jadwal, isi data, unggah surat, lalu tunggu konfirmasi WhatsApp.',
        ];

        if (! Schema::hasTable('site_settings')) {
            return $default;
        }

        return PublicCache::rememberCms('hero', fn () => SiteSetting::read('hero', $default));
    }

    /**
     * @return array<string, mixed>
     */
    private static function siteContentData(): array
    {
        if (! Schema::hasTable('site_settings')) {
            return SiteContentDefaults::siteContent();
        }

        return PublicCache::rememberCms(
            'site-content',
            fn () => SiteContentDefaults::mergeSiteContent(SiteSetting::read('site_content')),
        );
    }

    /**
     * @return array<int, array{question: string, answer: string}>
     */
    private static function faqData(): array
    {
        if (! Schema::hasTable('faqs')) {
            return self::fallbackFaqs();
        }

        $items = Faq::orderBy('sort_order')
            ->limit(8)
            ->get(['question', 'answer'])
            ->map(fn (Faq $faq): array => [
                'question' => $faq->question,
                'answer' => $faq->answer,
            ])
            ->all();

        if ($items !== []) {
            return $items;
        }

        return self::fallbackFaqs();
    }

    /**
     * @return array<int, array{question: string, answer: string}>
     */
    private static function fallbackFaqs(): array
    {
        return [
            [
                'question' => 'Apakah kunjungan ISTURA Gedung Agung Yogyakarta gratis?',
                'answer' => 'Ya. ISTURA adalah program kunjungan Istana Untuk Rakyat dan tidak dipungut biaya.',
            ],
            [
                'question' => 'Bagaimana cara booking kunjungan ISTURA Yogyakarta?',
                'answer' => 'Pengunjung memilih jadwal tersedia, mengisi data contact person dan instansi, mengunggah surat permohonan, lalu menunggu konfirmasi admin melalui WhatsApp.',
            ],
            [
                'question' => 'Apa syarat utama pendaftaran ISTURA?',
                'answer' => 'Siapkan surat permohonan resmi, data contact person, nomor WhatsApp aktif, jumlah rombongan, serta pilih jadwal yang masih tersedia.',
            ],
        ];
    }

    /**
     * @param  array<string, mixed>  $hero
     * @param  array<string, mixed>  $siteContent
     * @param  array<int, array{question: string, answer: string}>  $faqs
     * @return array<string, mixed>
     */
    private static function crawlerContent(array $hero, array $siteContent, array $faqs): array
    {
        return [
            'headline' => $hero['headline'] ?? 'ISTURA - Istana Untuk Rakyat',
            'subheadline' => $hero['subheadline'] ?? 'Booking Kunjungan Istana Kepresidenan Yogyakarta',
            'description' => self::HOME_DESCRIPTION,
            'quickInfo' => $siteContent['quickInfo'] ?? [],
            'schedule' => $siteContent['schedule'] ?? [],
            'bookingSteps' => $siteContent['bookingSteps'] ?? [],
            'rulesSection' => $siteContent['rulesSection'] ?? [],
            'letterSection' => $siteContent['letterSection'] ?? [],
            'activities' => $siteContent['activities'] ?? [],
            'faq' => $siteContent['faq'] ?? [],
            'faqs' => $faqs,
            'footer' => $siteContent['footer'] ?? [],
        ];
    }

    /**
     * @param  array<string, string>  $seo
     * @param  array<string, mixed>  $siteContent
     * @param  array<int, array{question: string, answer: string}>  $faqs
     */
    private static function structuredDataJson(array $seo, array $siteContent, array $faqs): string
    {
        $footer = $siteContent['footer'] ?? [];

        $data = [
            [
                '@context' => 'https://schema.org',
                '@type' => 'WebSite',
                'name' => 'ISTURA',
                'alternateName' => 'Istana Untuk Rakyat Yogyakarta',
                'url' => self::url('/'),
                'description' => self::HOME_DESCRIPTION,
                'inLanguage' => 'id-ID',
            ],
            [
                '@context' => 'https://schema.org',
                '@type' => 'GovernmentOrganization',
                'name' => 'ISTURA - Istana Untuk Rakyat',
                'url' => self::url('/'),
                'logo' => self::assetUrl('/assets/gedung-agung-gold.webp'),
                'description' => self::HOME_DESCRIPTION,
                'areaServed' => 'Yogyakarta, Indonesia',
                'address' => [
                    '@type' => 'PostalAddress',
                    'streetAddress' => $footer['address'] ?? 'Jl. Jend. Ahmad Yani, Ngupasan, Gondomanan',
                    'addressLocality' => 'Kota Yogyakarta',
                    'addressRegion' => 'Daerah Istimewa Yogyakarta',
                    'postalCode' => '55122',
                    'addressCountry' => 'ID',
                ],
            ],
            [
                '@context' => 'https://schema.org',
                '@type' => 'TouristAttraction',
                'name' => 'Istana Kepresidenan Yogyakarta - Gedung Agung',
                'alternateName' => 'Gedung Agung Yogyakarta',
                'url' => self::url('/'),
                'image' => $seo['image'],
                'description' => 'Lokasi kunjungan ISTURA untuk masyarakat di Istana Kepresidenan Yogyakarta.',
                'address' => [
                    '@type' => 'PostalAddress',
                    'streetAddress' => $footer['address'] ?? 'Jl. Jend. Ahmad Yani, Ngupasan, Gondomanan',
                    'addressLocality' => 'Kota Yogyakarta',
                    'addressRegion' => 'Daerah Istimewa Yogyakarta',
                    'postalCode' => '55122',
                    'addressCountry' => 'ID',
                ],
                'isAccessibleForFree' => true,
            ],
            [
                '@context' => 'https://schema.org',
                '@type' => 'FAQPage',
                'mainEntity' => array_map(fn (array $item): array => [
                    '@type' => 'Question',
                    'name' => $item['question'],
                    'acceptedAnswer' => [
                        '@type' => 'Answer',
                        'text' => $item['answer'],
                    ],
                ], $faqs),
            ],
            [
                '@context' => 'https://schema.org',
                '@type' => 'BreadcrumbList',
                'itemListElement' => [
                    [
                        '@type' => 'ListItem',
                        'position' => 1,
                        'name' => 'Beranda',
                        'item' => self::url('/'),
                    ],
                ],
            ],
        ];

        return json_encode(
            $data,
            JSON_UNESCAPED_SLASHES
                | JSON_UNESCAPED_UNICODE
                | JSON_PRETTY_PRINT
                | JSON_HEX_TAG
                | JSON_HEX_AMP
                | JSON_HEX_APOS
                | JSON_HEX_QUOT,
        ) ?: '[]';
    }

    private static function xml(string $value): string
    {
        return htmlspecialchars($value, ENT_XML1 | ENT_COMPAT, 'UTF-8');
    }
}
