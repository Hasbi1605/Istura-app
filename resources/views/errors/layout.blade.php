<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>@yield('title', 'Terjadi Kesalahan') · ISTURA</title>
    <link rel="icon" type="image/webp" href="/assets/gedung-agung-gold.webp" />
    {{-- Halaman error sengaja TIDAK memuat bundle Vite/React. Saat deploy,
         aset bisa sedang dibangun ulang; halaman ini harus berdiri sendiri.
         CSS dipisah ke file statis (bukan inline <style>) supaya lolos CSP
         style-src 'self'. --}}
    <link rel="stylesheet" href="/assets/error-page.css?v=1" />
    @yield('head')
</head>
<body>
    <main class="error-card" role="main">
        <img class="error-logo" src="/assets/gedung-agung-gold.webp" alt="Gedung Agung" />
        <span class="error-code">@yield('code', 'ERROR')</span>
        <h1 class="error-title">@yield('title', 'Terjadi Kesalahan')</h1>
        <p class="error-message">@yield('message', 'Maaf, terjadi kendala. Silakan coba beberapa saat lagi.')</p>
        @hasSection('actions')
            <div class="error-actions">@yield('actions')</div>
        @endif
        <p class="error-foot">ISTURA · Istana Untuk Rakyat</p>
    </main>
</body>
</html>
