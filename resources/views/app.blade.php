<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="csrf-token" content="{{ csrf_token() }}" />
    <title>ISTURA - Istana Untuk Rakyat</title>
    <meta property="og:title" content="ISTURA - Istana Untuk Rakyat" />
    <meta name="twitter:title" content="ISTURA - Istana Untuk Rakyat" />
    <link rel="icon" type="image/webp" href="/assets/gedung-agung-gold.webp" />
    <link rel="preload" as="image" href="/assets/hero-istana.webp" fetchpriority="high" />
    <link rel="preload" as="image" href="/assets/miky-greeting.webp" fetchpriority="high" />
    <link rel="prefetch" as="image" href="/assets/miky-step-4.webp" />
    <link rel="prefetch" as="image" href="/assets/miky-hero-3.webp" />
    @viteReactRefresh
    @vite(['resources/js/main.tsx'])
</head>
<body>
    <div id="root"></div>
</body>
</html>
