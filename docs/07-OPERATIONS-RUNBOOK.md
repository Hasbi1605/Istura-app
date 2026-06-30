# Operations Runbook

## Proses yang Harus Hidup

- Web server: Nginx/Apache + PHP-FPM.
- Queue worker: menjalankan job database.
- Reverb: WebSocket realtime.
- Scheduler: menjalankan schedule Laravel.
- MySQL.

Pada deploy AWS saat ini, queue/Reverb/scheduler dikelola Supervisor dengan config di
`deploy/supervisor/`.

## Command Harian

```bash
php artisan about
php artisan queue:work --once
php artisan schedule:list
php artisan route:list
php artisan config:clear
```

Gunakan `config:clear` hanya saat debugging; production normal memakai cache config.

## Backup Minimal

Backup harus mencakup:

- Database MySQL.
- `.env` production.
- `storage/app/private/booking-letters/`.
- `storage/app/public/` untuk asset CMS.
- Konfigurasi Nginx/Supervisor/TLS jika dikelola manual di server.

Jangan menyimpan backup berisi PII di lokasi publik.

## Restore Minimal

1. Siapkan server runtime.
2. Deploy source.
3. Restore `.env`.
4. Restore database.
5. Restore `storage/app`.
6. Jalankan `php artisan storage:link`.
7. Jalankan cache Laravel.
8. Start queue, scheduler, Reverb.
9. Cek health endpoint dan login admin.

## Logs

Lokasi umum:

- Laravel: `storage/logs/laravel.log`.
- Web server/PHP-FPM: sesuai distro/server.
- Supervisor: sesuai config server.
- GitHub Actions: tab Actions repo.

## Masalah Umum

### Admin tidak bisa login

- Cek `SESSION_DOMAIN`, `SANCTUM_STATEFUL_DOMAINS`, `CORS_ALLOWED_ORIGINS`.
- Pastikan HTTPS dan `SESSION_SECURE_COOKIE=true` di production.
- Cek apakah email user sudah verified.
- Jika 2FA bermasalah, gunakan command `php artisan users:reset-2fa` sesuai implementasi
  `ResetUserTwoFactor`.

### Realtime mati

- Cek proses Reverb.
- Cek `REVERB_HOST`, `REVERB_PORT`, `REVERB_SCHEME`, `REVERB_ALLOWED_ORIGINS`.
- Rebuild frontend jika `VITE_REVERB_*` berubah.
- Aplikasi tetap bisa dipakai dengan reload/refetch manual.

### Upload gagal

- Aplikasi membatasi file 5 MB.
- Pastikan PHP `upload_max_filesize` dan `post_max_size` di atas batas aplikasi.
- Cek permission `storage/app` dan `storage/app/public`.

### Jadwal libur tidak sinkron

- Jalankan `php artisan holidays:sync-id`.
- Cek env `INDONESIAN_HOLIDAYS_*`.

### Pending lama terlihat menahan slot

Ini perilaku saat ini. Pending tidak expired berdasarkan umur pengajuan. Command
`bookings:expire-pending` hanya menandai Expired saat jam kunjungan sudah lewat.

## Setelah Deploy

```bash
curl -fsS https://DOMAIN/up
curl -fsS https://DOMAIN/api/public/bootstrap
curl -fsS https://DOMAIN/sitemap.xml
```

Lanjut cek browser:

- Homepage tampil.
- Jadwal tampil.
- Admin login.
- Booking list tampil.
- Realtime status tidak error.
