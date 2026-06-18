<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>{{ $seo['title'] }}</title>
    <meta name="description" content="{{ $seo['description'] }}" />
    <link rel="canonical" href="{{ $seo['canonicalUrl'] }}" />
    <link rel="icon" type="image/webp" href="/assets/gedung-agung-gold.webp" />
    <meta name="robots" content="index, follow" />

    {{-- Open Graph: dibaca WhatsApp/Facebook/Telegram untuk kartu preview. --}}
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="{{ $seo['siteName'] }}" />
    <meta property="og:title" content="{{ $seo['title'] }}" />
    <meta property="og:description" content="{{ $seo['description'] }}" />
    <meta property="og:url" content="{{ $seo['canonicalUrl'] }}" />
    <meta property="og:image" content="{{ $seo['image'] }}" />
    <meta property="og:image:secure_url" content="{{ $seo['image'] }}" />
    <meta property="og:image:type" content="{{ $seo['imageType'] }}" />
    <meta property="og:image:width" content="{{ $seo['imageWidth'] }}" />
    <meta property="og:image:height" content="{{ $seo['imageHeight'] }}" />
    <meta property="og:image:alt" content="{{ $seo['imageAlt'] }}" />

    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="{{ $seo['title'] }}" />
    <meta name="twitter:description" content="{{ $seo['description'] }}" />
    <meta name="twitter:image" content="{{ $seo['image'] }}" />

    {{-- CSS dipisah ke file statis (bukan inline <style>) supaya lolos CSP
         style-src 'self'. Halaman tetap berdiri sendiri tanpa bundle React. --}}
    <link rel="stylesheet" href="/assets/info-page.css?v=3" />
</head>
<body>
    <main class="info-shell" role="main">
        {{-- Breadcrumb --}}
        <nav class="seo-breadcrumb" aria-label="Breadcrumb">
            <a href="/">Beranda</a>
            <span aria-hidden="true">&gt;</span>
            <span>{{ $page['h1'] }}</span>
        </nav>

        {{-- Header --}}
        <header class="info-head">
            <img class="info-logo" src="/assets/gedung-agung-gold.webp" alt="Gedung Agung" />
            <h1 class="info-title">{{ $page['h1'] }}</h1>
            <p class="info-sub">{{ $page['intro'] }}</p>
        </header>

        {{-- Content sections --}}
        @foreach ($page['sections'] as $section)
            <section class="seo-section">
                <h2>{{ $section['heading'] }}</h2>
                @foreach ((array) ($section['body'] ?? []) as $paragraph)
                    <p>{{ $paragraph }}</p>
                @endforeach
                @if (!empty($section['items']))
                    <ul class="seo-section-items">
                        @foreach ($section['items'] as $item)
                            <li>{{ $item }}</li>
                        @endforeach
                    </ul>
                @endif
            </section>
        @endforeach

        {{-- FAQ --}}
        @if (!empty($page['faqs']))
            <section class="seo-faq">
                <h2>Pertanyaan Umum</h2>
                @foreach ($page['faqs'] as $faq)
                    <details class="seo-faq-item">
                        <summary>{{ $faq['question'] }}</summary>
                        <p>{{ $faq['answer'] }}</p>
                    </details>
                @endforeach
            </section>
        @endif

        {{-- Internal links / related pages --}}
        @if (!empty($page['links']))
            <nav class="seo-links" aria-label="Halaman terkait">
                <h2>Panduan Lainnya</h2>
                <div class="seo-links-list">
                    @foreach ($page['links'] as $link)
                        <a href="{{ $link['href'] }}">{{ $link['label'] }}</a>
                    @endforeach
                </div>
            </nav>
        @endif

        {{-- CTA --}}
        @if (!empty($page['cta']))
            <div class="seo-cta-wrap">
                <a class="seo-cta" href="{{ $page['cta']['href'] }}">{{ $page['cta']['label'] }}</a>
            </div>
        @endif

        <p class="info-foot">ISTURA · Istana Untuk Rakyat</p>
    </main>

    {{-- Structured Data (JSON-LD) — pre-encoded by SeoMeta with hex-safe flags --}}
    <script type="application/ld+json">{!! $structuredDataJson !!}</script>
</body>
</html>
