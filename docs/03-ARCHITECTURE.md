# Architecture

## Ringkasan

ISTURA adalah monolit Laravel + React. Laravel meng-host shell SPA React, API, route info
server-rendered, dan Reverb. React memakai router berbasis state dari `useIsturaData`,
bukan route URL frontend.

## Entry Point

- `public/index.php` → Laravel.
- `routes/web.php` → robots, sitemap, halaman info, dan catch-all SPA.
- `routes/api.php` → public, auth, dan admin API.
- `resources/views/app.blade.php` → shell SPA.
- `resources/js/main.tsx` dan `resources/js/App.tsx` → entry React.

## Backend

Pola utama:

- Controller tipis di `app/Http/Controllers`.
- Validasi di `app/Http/Requests`.
- Bentuk JSON camelCase di `app/Http/Resources`.
- Logika domain di `app/Services`.
- Broadcast via `app/Events`.
- Auth/role/2FA via middleware dan model `User`.

Service penting:

- `BookingService`: lifecycle booking, kloter, move, hard delete, update kontak.
- `ScheduleService`: horizon jadwal, status slot, H/H+1, pemblokiran Istura Open.
- `OpenRegistrationService`: pendaftaran Istura Open, kuota atomik, dedup NIK/WA.
- `CmsImageService`: validasi dan konversi gambar CMS ke WebP.
- `AuditLogger`: pencatatan audit.
- `NationalHolidaySyncService`: sinkron tanggal merah.
- `TwoFactorService`: TOTP, recovery code, trusted device.

## Frontend

- State utama di `resources/js/hooks/useIsturaData.ts`.
- API wrapper di `resources/js/api/client.ts`.
- API domain di `resources/js/api/*`.
- Tipe domain di `resources/js/domain/types.ts`.
- Realtime typed di `resources/js/realtime/echo.ts`.
- Komponen admin di `resources/js/components/admin`.
- Komponen publik booking/feedback/open/home/layout di `resources/js/components`.

## Realtime

Reverb dipakai untuk:

- `admin.bookings` private channel.
- `public.schedule`.
- `public.open`.

Jika `VITE_REVERB_ENABLED=false`, aplikasi tetap berjalan dengan reload/refetch cadangan.

## Server-Rendered Info Pages

`routes/web.php` melayani:

- `/robots.txt`
- `/sitemap.xml`
- `/info/alur-kunjungan`
- `/info/{slug}` berdasarkan `config/seo_pages.php`

Route `/info/{slug}` dibatasi dengan `whereIn`, sehingga slug tidak dikenal menjadi 404 dan
tidak jatuh ke SPA.

## Deployment Saat Ini

`.github/workflows/deploy.yml` melakukan:

1. Build dan test di GitHub Actions.
2. Upload `git archive` ke S3 privat.
3. Jalankan deploy di EC2 via AWS SSM.
4. Script `deploy/aws/deploy.sh` menginstall dependency, build frontend, migrate, cache Laravel,
   restart Supervisor, dan health check.

Lihat `docs/05-DEPLOYMENT.md` untuk detail.
