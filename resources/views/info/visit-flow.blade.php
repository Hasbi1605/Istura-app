@php
    // URL absolut wajib untuk OG tag (crawler WhatsApp/Facebook tidak resolve
    // path relatif). og:image sengaja memakai JPG, bukan webp, karena crawler
    // WA tidak andal merender webp sebagai preview.
    $base = rtrim(config('app.url'), '/');
    $ogImage = $base.'/assets/alur-kunjungan.jpg';
    $pageUrl = $base.'/info/alur-kunjungan';
    $title = 'Alur & Peraturan Kunjungan ISTURA';
    $description = 'Panduan alur dan peraturan kunjungan Istana Kepresidenan Yogyakarta (Gedung Agung).';
@endphp
<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>{{ $title }}</title>
    <meta name="description" content="{{ $description }}" />
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
    <meta property="og:image:width" content="1190" />
    <meta property="og:image:height" content="1542" />
    <meta property="og:image:alt" content="Alur Kunjungan ISTURA" />

    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="{{ $title }}" />
    <meta name="twitter:description" content="{{ $description }}" />
    <meta name="twitter:image" content="{{ $ogImage }}" />

    {{-- Halaman berdiri sendiri tanpa bundle React supaya selalu tampil
         walau aset sedang dibangun ulang saat deploy. --}}
    <style>
        :root {
            --navy: #10182f;
            --navy-2: #172346;
            --gold: #c49212;
            --gold-2: #e5bd55;
            --paper: #fffaf0;
        }

        * { box-sizing: border-box; }

        html, body { margin: 0; padding: 0; }

        body {
            min-height: 100vh;
            padding: 32px 20px 56px;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
                Helvetica, Arial, sans-serif;
            color: var(--paper);
            background:
                radial-gradient(circle at 20% 12%, rgba(229, 189, 85, 0.08) 0, transparent 42%),
                radial-gradient(circle at 80% 88%, rgba(229, 189, 85, 0.06) 0, transparent 42%),
                linear-gradient(160deg, var(--navy), var(--navy-2));
        }

        .info-shell {
            width: 100%;
            max-width: 720px;
            margin: 0 auto;
        }

        .info-head {
            text-align: center;
            margin-bottom: 28px;
        }

        .info-logo {
            width: 72px;
            height: auto;
            margin: 0 auto 16px;
            display: block;
        }

        .info-title {
            margin: 0 0 8px;
            font-size: 1.5rem;
            font-weight: 800;
            color: #fff;
        }

        .info-sub {
            margin: 0 auto;
            max-width: 480px;
            font-size: 0.95rem;
            line-height: 1.6;
            color: rgba(255, 255, 255, 0.72);
        }

        .info-figure {
            margin: 0 0 28px;
            background: rgba(255, 255, 255, 0.04);
            border: 1px solid rgba(229, 189, 85, 0.18);
            border-radius: 18px;
            padding: 16px;
            box-shadow: 0 18px 44px rgba(0, 0, 0, 0.3);
        }

        .info-figure h2 {
            margin: 4px 4px 14px;
            font-size: 1.05rem;
            font-weight: 700;
            color: var(--gold-2);
        }

        .info-figure img {
            display: block;
            width: 100%;
            height: auto;
            border-radius: 12px;
            background: #fff;
        }

        .info-foot {
            margin-top: 8px;
            text-align: center;
            font-size: 0.78rem;
            letter-spacing: 0.04em;
            color: rgba(255, 255, 255, 0.4);
        }
    </style>
</head>
<body>
    <main class="info-shell" role="main">
        <header class="info-head">
            <img class="info-logo" src="/assets/gedung-agung-gold.webp" alt="Gedung Agung" />
            <h1 class="info-title">{{ $title }}</h1>
            <p class="info-sub">{{ $description }}</p>
        </header>

        <figure class="info-figure">
            <h2>Alur Kunjungan</h2>
            <img src="/assets/alur-kunjungan.webp" alt="Alur kunjungan ISTURA: Gerbang Timur, Pos Satu, spot foto, hingga Museum." loading="eager" />
        </figure>

        <figure class="info-figure">
            <h2>Peraturan Kunjungan</h2>
            <img src="/assets/peraturan-kunjungan.webp" alt="Peraturan kunjungan ISTURA." loading="lazy" />
        </figure>

        <p class="info-foot">ISTURA · Istana Untuk Rakyat</p>
    </main>
</body>
</html>
