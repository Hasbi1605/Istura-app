# ISTURA Web

Sistem booking kunjungan **Istana Untuk Rakyat (ISTURA)** Yogyakarta. Repo ini adalah
monolit **Laravel 13 + React 19**: Laravel melayani REST API, WebSocket Reverb,
halaman info server-rendered, dan shell SPA React pada satu origin.

## Mulai Dari Sini

- [Handover mentor](docs/00-HANDOVER.md) — ringkasan sistem, status, dan checklist serah terima.
- [Product overview](docs/01-PRODUCT-OVERVIEW.md) — fitur publik, admin, dan Istura Open.
- [Panduan admin/operator](docs/02-ADMIN-USER-GUIDE.md) — alur pakai harian non-teknis.
- [Arsitektur](docs/03-ARCHITECTURE.md) — peta Laravel, React, Reverb, route, dan service.
- [Environment](docs/04-ENVIRONMENT.md) — variabel `.env` penting.
- [Deployment](docs/05-DEPLOYMENT.md) — deploy saat ini dan opsi server baru.
- [Migrasi domain](docs/06-DOMAIN-MIGRATION.md) — checklist ketika domain pindah.
- [Runbook operasional](docs/07-OPERATIONS-RUNBOOK.md) — backup, restore, logs, 2FA, queue.
- [Security & privacy](docs/08-SECURITY-PRIVACY.md) — NIK, surat, role, 2FA, rate limit.
- [Ringkasan database](docs/09-DATABASE-SUMMARY.md) — tabel dan relasi utama.
- [Codebase context](docs/CODEBASE-CONTEXT.md) — peta detail file untuk developer/agent.

Dokumen produk lengkap tetap ada di [PRD-ISTURA-APP.md](PRD-ISTURA-APP.md). Dokumen
khusus modul Istura Open ada di [IsturaOpen.md](IsturaOpen.md).

## Stack

- Backend: Laravel 13, PHP 8.4, MySQL.
- Frontend: React 19, TypeScript, Vite 8, GSAP, lucide-react.
- Auth admin: Laravel Sanctum cookie session, role `viewer`/`admin`/`super_admin`, 2FA TOTP.
- Realtime: Laravel Reverb + `laravel-echo` / `pusher-js`.
- Ekspor browser: pdfmake, exceljs, jszip, html-to-image.
- Cache, session, dan queue: database driver.
- File privat: surat booking di `storage/app/private/booking-letters/`.

## Fitur Utama

- Publik melihat landing page, jadwal, halaman info SEO, wizard booking rombongan,
  feedback pasca-kunjungan, dan modul Istura Open saat event aktif.
- Admin mengelola booking, jadwal, feedback, CMS, template WhatsApp, laporan,
  poster mingguan, audit log, user admin, dan Istura Open.
- Booking publik normal H+2 sampai 2 bulan. H/H+1 default tertutup dan hanya tampil
  jika admin membuka slot dengan marker eksplisit.
- Pending booking tidak punya TTL umur pengajuan; status Expired hanya saat jam kunjungan
  sudah terlewat.
- Feedback rombongan dapat diisi sampai `group_size` kali selama 14 hari setelah Completed.

## Prasyarat Lokal

- PHP 8.4 dan Composer.
- Node.js 22 direkomendasikan sesuai CI, Node 20+ masih cukup untuk Vite modern.
- MySQL berjalan. Default contoh `.env` memakai port `3306`; sesuaikan jika mesin lokal
  memakai port lain.

## Setup Lokal

```bash
composer install
npm install

cp .env.example .env
php artisan key:generate

mysql -uroot -p -e "CREATE DATABASE istura CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
php artisan migrate --seed
```

Seeder production tidak membuat user admin. Di lokal/testing, `UserSeeder` hanya membuat
akun dari `database/seeders/data/admin_users.json` jika `SEED_ADMIN_PASSWORD` diisi.

## Menjalankan Aplikasi

Jalankan proses ini di terminal terpisah:

```bash
php artisan serve --port=8000
npm run dev
php artisan reverb:start --port=8080
```

Akses aplikasi di `http://localhost:8000`.

Realtime bisa dimatikan dengan `VITE_REVERB_ENABLED=false`; aplikasi tetap berjalan dengan
refetch manual/fallback.

## Verifikasi

```bash
php artisan test
npm run build
```

Untuk QA browser lokal, repo saat ini memiliki:

```bash
QA_BASE=http://localhost:8000 node scripts/e2e-user-flow.mjs
```

## Production Ringkas

Template env production ada di [.env.production.example](.env.production.example).
Deploy saat ini memakai GitHub Actions `.github/workflows/deploy.yml` ke AWS EC2 via SSM
dan menjalankan [deploy/aws/deploy.sh](deploy/aws/deploy.sh). Jika sistem dipindah ke
server/domain milik Istana, ikuti [docs/05-DEPLOYMENT.md](docs/05-DEPLOYMENT.md) dan
[docs/06-DOMAIN-MIGRATION.md](docs/06-DOMAIN-MIGRATION.md).

## Catatan Keamanan

- Jangan commit `.env`, dump database production, surat permohonan, atau data NIK mentah.
- NIK disimpan terenkripsi dan hanya `nik_masked`/`nik_hash` yang dipakai untuk tampilan/dedup.
- Surat permohonan disimpan privat dan diakses melalui endpoint admin.
- Endpoint publik memakai rate limit; admin memakai Sanctum, role, 2FA, dan audit log.

Lihat [SECURITY.md](SECURITY.md) untuk ringkasan keamanan dan pelaporan isu.
