@php
    use App\Support\SeoMeta;

    // URL absolut wajib untuk OG tag (crawler WhatsApp/Facebook tidak resolve
    // path relatif). og:image sengaja memakai JPG, bukan webp, karena crawler
    // WA tidak andal merender webp sebagai preview.
    $ogImage = SeoMeta::assetUrl('/assets/peraturan-kunjungan.jpg');
    $pageUrl = SeoMeta::url('/info/alur-kunjungan');
    $title = 'Alur & Peraturan Kunjungan ISTURA';
    $description = 'Panduan alur dan peraturan kunjungan Istana Kepresidenan Yogyakarta (Gedung Agung).';
    // Lokasi diambil dari CMS (footer). Fallback ke nilai default bila kosong.
    $mapUrl = $mapUrl ?? null;
    $address = $address ?? null;
@endphp
<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>{{ $title }}</title>
    <meta name="description" content="{{ $description }}" />
    <link rel="canonical" href="{{ $pageUrl }}" />
    <link rel="icon" type="image/webp" href="/assets/gedung-agung-gold.webp" />

    {{-- Open Graph: dibaca WhatsApp/Facebook/Telegram untuk kartu preview. --}}
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="ISTURA" />
    <meta property="og:title" content="{{ $title }}" />
    <meta property="og:description" content="{{ $description }}" />
    <meta property="og:url" content="{{ $pageUrl }}" />
    <meta property="og:image" content="{{ $ogImage }}" />
    <meta property="og:image:secure_url" content="{{ $ogImage }}" />
    <meta property="og:image:type" content="image/jpeg" />
    <meta property="og:image:width" content="819" />
    <meta property="og:image:height" content="1024" />
    <meta property="og:image:alt" content="Peraturan Kunjungan ISTURA" />

    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="{{ $title }}" />
    <meta name="twitter:description" content="{{ $description }}" />
    <meta name="twitter:image" content="{{ $ogImage }}" />

    {{-- CSS dipisah ke file statis (bukan inline <style>) supaya lolos CSP
         style-src 'self'. Halaman tetap berdiri sendiri tanpa bundle React. --}}
    <link rel="stylesheet" href="/assets/info-page.css?v=2" />
</head>
<body>
    <main class="info-shell" role="main">
        <header class="info-head">
            <img class="info-logo" src="/assets/gedung-agung-gold.webp" alt="Gedung Agung" />
            <h1 class="info-title">{{ $title }}</h1>
            <p class="info-sub">{{ $description }}</p>
        </header>

        <div class="info-grid">
            <figure class="info-figure">
                <h2>Alur Kunjungan</h2>
                <a href="/assets/alur-kunjungan.webp?v=2" target="_blank" rel="noopener noreferrer" aria-label="Perbesar gambar alur kunjungan">
                    <img src="/assets/alur-kunjungan.webp?v=2" alt="Alur kunjungan ISTURA: Gerbang Timur, Pos Satu, spot foto, hingga Museum." loading="eager" />
                </a>
            </figure>

            <figure class="info-figure">
                <h2>Peraturan Kunjungan</h2>
                <a href="/assets/peraturan-kunjungan.webp" target="_blank" rel="noopener noreferrer" aria-label="Perbesar gambar peraturan kunjungan">
                    <img src="/assets/peraturan-kunjungan.webp" alt="Peraturan kunjungan ISTURA." loading="lazy" />
                </a>
            </figure>
        </div>

        @if ($mapUrl)
            <section class="info-location" aria-label="Lokasi Gedung Agung">
                <h2>Lokasi</h2>
                @if ($address)
                    <p>{{ $address }}</p>
                @endif
                <a
                    class="info-map-link"
                    href="{{ $mapUrl }}"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Buka lokasi Gedung Agung di Google Maps"
                >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                        <circle cx="12" cy="10" r="3" />
                    </svg>
                    Lihat lokasi di Google Maps
                </a>
            </section>
        @endif

        <p class="info-foot">ISTURA · Istana Untuk Rakyat</p>
    </main>
</body>
</html>
