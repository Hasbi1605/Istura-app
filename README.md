# ISTURA Web — Laravel + React (monolith)

Aplikasi kunjungan **Istana Untuk Rakyat (ISTURA)** Yogyakarta. Backend Laravel 13
melayani REST API + WebSocket realtime (Reverb) dan menghost frontend React 19
(Vite) sebagai SPA pada satu origin.

Hasil migrasi dari project React murni (`../istura-web`) yang sebelumnya menyimpan
data di `localStorage`. Tampilan & interaksi dipertahankan; sumber data dipindah
ke MySQL via API. Lihat `../PRD-MIGRATION.md` untuk rincian.

## Stack

- Laravel 13 (PHP 8.4), MySQL
- Auth: Laravel Sanctum (SPA cookie session)
- Realtime: Laravel Reverb + `laravel-echo` / `pusher-js`
- Frontend: React 19 + Vite, GSAP, lucide-react
- Ekspor PDF/XLSX/ZIP: tetap di browser (pdfmake, exceljs, jszip)

## Prasyarat

- PHP 8.4, Composer
- Node 20+ / npm
- MySQL berjalan (dev ini di port **3307**; sesuaikan `.env` bila beda)

## Setup

```bash
# 1. Dependencies
composer install
npm install

# 2. Environment
cp .env.example .env
php artisan key:generate
# Edit .env: set DB_PORT (3306/3307), DB_PASSWORD, DB_SOCKET bila perlu

# 3. Database
mysql -uroot -p -e "CREATE DATABASE istura CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
php artisan migrate --seed
```

Seeder mengisi data demo yang identik dengan mock lama di `App.tsx`
(51 booking, 21 feedback, 6 FAQ, 3 kontak, 4 template WA, 3 user admin).

## Menjalankan (dev)

Butuh **3 proses** paralel. Buka 3 terminal:

```bash
php artisan serve --port=8000      # 1. Laravel  → http://localhost:8000
npm run dev                        # 2. Vite (HMR) → http://localhost:5175
php artisan reverb:start --port=8080  # 3. Reverb (WebSocket)
```

Akses aplikasi di **http://localhost:8000**.

> Realtime dapat dimatikan dengan `VITE_REVERB_ENABLED=false` di `.env`
> (aplikasi tetap berjalan, hanya tanpa auto-update dashboard).

## Akun admin (seed)

| Email | Password | Peran |
|---|---|---|
| `admin@istura.id` | `istura2026` | Super Admin |
| `operator@istura.id` | `istura2026` | Admin |
| `editor@istura.id` | `istura2026` | Viewer |

> Ganti password untuk produksi.

## Build produksi

```bash
npm run build      # bundling React → public/build
php artisan config:cache route:cache
```

## Struktur penting

```
app/
  Http/Controllers/{Auth,Public,Admin}/   # thin controllers
  Http/Requests/                          # validasi per-action
  Http/Resources/                         # bentuk JSON (camelCase, mirror React)
  Models/                                 # Eloquent
  Services/                               # logika domain (BookingService, ScheduleService, ...)
  Events/                                 # broadcast: BookingCreated, BookingStatusChanged, FeedbackSubmitted
database/
  migrations/  seeders/  seeders/data/*.json  # JSON di-extract dari App.tsx lama
resources/
  js/        # React (App.tsx + api/ + realtime/ + exports)
  views/app.blade.php   # shell SPA
routes/
  api.php  web.php(catch-all → SPA)  channels.php
```

## API ringkas

- Public: `GET /api/public/{faqs,contacts,schedule,wa-templates}`, `POST /api/public/bookings`,
  `GET|POST /api/public/feedback/{code}`
- Auth: `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`
- Admin (Sanctum): `GET /api/admin/dashboard`, CRUD `bookings`, `schedule`,
  `feedback`, `cms/{faqs,contacts,wa-templates}`, `users`, `audit-logs`

## QA

Skrip Playwright di `scripts/` (jalankan saat dev server hidup):

```bash
node scripts/qa-migration.mjs    # data live + Echo init
node scripts/qa-realtime.mjs     # submit booking → muncul realtime di admin
node scripts/qa-assets.mjs       # tidak ada 404 asset / error JS
QA_BASE=http://localhost:8000 node scripts/qa-admin-flow.mjs   # alur admin penuh
```

## Catatan keamanan

- NIK disimpan terenkripsi (`Crypt`); kolom `nik_masked` untuk tampilan.
- Surat permohonan disimpan privat di `storage/app/private/booking-letters/`,
  diakses admin via endpoint download (bukan URL publik).
- Endpoint publik dibatasi rate-limit; upload divalidasi mime + ukuran ≤ 5 MB.
