# Environment

Gunakan `.env.example` untuk lokal dan `.env.production.example` sebagai template production.
Jangan commit `.env` asli.

## App dan Domain

- `APP_ENV`: `local`, `testing`, atau `production`.
- `APP_KEY`: wajib diisi dengan `php artisan key:generate`.
- `APP_DEBUG`: harus `false` di production.
- `APP_URL`: URL aplikasi yang aktif.
- `PUBLIC_CANONICAL_URL`: URL canonical untuk SEO, sitemap, robots, OG tag.
- `SEO_REDIRECT_TO_CANONICAL`: aktifkan redirect domain lama ke canonical.
- `SEO_REDIRECT_FROM_HOSTS`: daftar host lama yang boleh diredirect ke canonical.

## Database

- `DB_CONNECTION=mysql`
- `DB_HOST`
- `DB_PORT`
- `DB_DATABASE`
- `DB_USERNAME`
- `DB_PASSWORD`
- `DB_SOCKET` bila MySQL memakai socket.

## Session, Sanctum, CORS

- `SESSION_DRIVER=database`
- `SESSION_LIFETIME`
- `ADMIN_SESSION_ABSOLUTE_LIFETIME`
- `SESSION_ENCRYPT=true` di production.
- `SESSION_SECURE_COOKIE=true` di production HTTPS.
- `SESSION_DOMAIN`: kosong untuk host persis; isi `.domain.go.id` hanya jika butuh subdomain.
- `SANCTUM_STATEFUL_DOMAINS`: host frontend/admin yang memakai cookie Sanctum.
- `CORS_ALLOWED_ORIGINS`: origin browser yang diizinkan.

## Reverb

- `BROADCAST_CONNECTION=reverb`
- `REVERB_APP_ID`
- `REVERB_APP_KEY`
- `REVERB_APP_SECRET`
- `REVERB_HOST`
- `REVERB_PORT`
- `REVERB_SCHEME`
- `REVERB_ALLOWED_ORIGINS`: host saja, bukan URL penuh.
- `VITE_REVERB_ENABLED`
- `VITE_REVERB_APP_KEY`
- `VITE_REVERB_HOST`
- `VITE_REVERB_PORT`
- `VITE_REVERB_SCHEME`

## Storage, Queue, Cache

- `FILESYSTEM_DISK=local`
- `QUEUE_CONNECTION=database`
- `CACHE_STORE=database`
- `SESSION_DRIVER=database`

Pastikan scheduler dan queue worker aktif di production.

## Upload dan Link Eksternal

- Upload surat/poster/foto dibatasi 5 MB pada aplikasi.
- `PUBLIC_IMAGE_HOSTS`: host tambahan untuk gambar publik yang dikelola CMS.
- `DOCUMENTATION_LINK_HOSTS`: host HTTPS yang boleh dipakai sebagai link dokumentasi kunjungan.

## Admin Seed

- `SEED_ADMIN_PASSWORD`: hanya untuk bootstrap admin lokal/awal.
- Production sebaiknya tidak menjalankan seed user dengan password tetap.
- Setelah akun admin pertama dibuat, rotate password dan kosongkan env ini.

## Audit dan Libur Nasional

- `AUDIT_LOG_RETENTION_DAYS`: default 180.
- `INDONESIAN_HOLIDAYS_URL`
- `INDONESIAN_HOLIDAYS_TIMEOUT`
- `INDONESIAN_HOLIDAYS_AUTO_SYNC`
- `INDONESIAN_HOLIDAYS_AUTO_SYNC_RETRY_MINUTES`

## Variabel yang Sudah Tidak Dipakai

- `PUBLIC_BOOKING_PENDING_TTL_HOURS` tidak dipakai lagi. Pending booking hanya Expired saat
  jam kunjungan sudah terlewat.
