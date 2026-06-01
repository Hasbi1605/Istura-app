<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>@yield('title', 'Terjadi Kesalahan') · ISTURA</title>
    <link rel="icon" type="image/webp" href="/assets/gedung-agung-gold.webp" />
    {{-- Halaman error sengaja TIDAK memuat bundle Vite/React. Saat deploy,
         aset bisa sedang dibangun ulang; halaman ini harus berdiri sendiri
         dengan CSS inline supaya selalu tampil rapi. --}}
    <style>
        :root {
            --navy: #10182f;
            --navy-2: #172346;
            --gold: #c49212;
            --gold-2: #e5bd55;
            --paper: #fffaf0;
        }

        * { box-sizing: border-box; }

        html, body {
            margin: 0;
            padding: 0;
            min-height: 100vh;
        }

        body {
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 24px;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
                Helvetica, Arial, sans-serif;
            color: var(--paper);
            background:
                radial-gradient(circle at 20% 20%, rgba(229, 189, 85, 0.08) 0, transparent 45%),
                radial-gradient(circle at 80% 80%, rgba(229, 189, 85, 0.06) 0, transparent 45%),
                linear-gradient(160deg, var(--navy), var(--navy-2));
        }

        .error-card {
            width: 100%;
            max-width: 480px;
            text-align: center;
            padding: 40px 32px;
            background: rgba(255, 255, 255, 0.04);
            border: 1px solid rgba(229, 189, 85, 0.18);
            border-radius: 18px;
            box-shadow: 0 24px 60px rgba(0, 0, 0, 0.35);
        }

        .error-logo {
            width: 84px;
            height: auto;
            margin: 0 auto 22px;
            display: block;
        }

        .error-code {
            display: inline-block;
            margin-bottom: 14px;
            padding: 4px 14px;
            font-size: 0.78rem;
            font-weight: 800;
            letter-spacing: 0.14em;
            color: var(--navy);
            background: var(--gold-2);
            border-radius: 999px;
        }

        .error-title {
            margin: 0 0 10px;
            font-size: 1.5rem;
            font-weight: 800;
            color: #fff;
        }

        .error-message {
            margin: 0 auto;
            max-width: 360px;
            font-size: 0.98rem;
            line-height: 1.6;
            color: rgba(255, 255, 255, 0.72);
        }

        .error-actions {
            margin-top: 26px;
        }

        .error-button {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 11px 22px;
            font-size: 0.9rem;
            font-weight: 700;
            text-decoration: none;
            color: var(--navy);
            background: linear-gradient(135deg, var(--gold-2), var(--gold));
            border-radius: 999px;
            box-shadow: 0 12px 24px rgba(196, 146, 18, 0.28);
            transition: transform 0.15s ease;
        }

        .error-button:hover { transform: translateY(-1px); }

        .error-foot {
            margin-top: 28px;
            font-size: 0.78rem;
            letter-spacing: 0.04em;
            color: rgba(255, 255, 255, 0.4);
        }
    </style>
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
