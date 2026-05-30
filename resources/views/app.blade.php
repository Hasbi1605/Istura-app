<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="csrf-token" content="{{ csrf_token() }}" />
    <title>ISTURA - Istana Untuk Rakyat</title>
    <meta property="og:title" content="ISTURA - Istana Untuk Rakyat" />
    <meta name="twitter:title" content="ISTURA - Istana Untuk Rakyat" />
    <link rel="icon" type="image/png" href="/assets/gedung-agung-gold.png" />
    <script>
        window.__ISTURA_CONFIG__ = @json(['publicAppUrl' => config('app.url')]);
    </script>
    @viteReactRefresh
    @vite(['resources/js/main.tsx'])
</head>
<body>
    <div id="root"></div>
</body>
</html>
