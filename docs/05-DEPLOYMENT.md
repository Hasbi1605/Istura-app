# Deployment

## Deploy Saat Ini

Workflow saat ini berada di `.github/workflows/deploy.yml`.

Alurnya:

1. Checkout repo.
2. Install PHP 8.4 dan Node 22.
3. `composer install`.
4. Copy `.env.example` untuk test, generate key.
5. `npm ci --ignore-scripts`.
6. `npm run build`.
7. `php artisan test`.
8. Upload source archive ke S3.
9. Jalankan `deploy/aws/deploy.sh` di EC2 lewat AWS SSM.
10. Verifikasi endpoint publik.

Variabel workflow `AWS_REGION`, `AWS_ROLE_ARN`, `DEPLOY_BUCKET`, `INSTANCE_ID`,
`DEPLOY_PATH`, `HEALTHCHECK_HOST`, dan `PRODUCTION_BASE_URL` wajib diset sebagai GitHub
Actions Variables di repository settings. Nilai production tidak disimpan sebagai fallback
di file workflow agar repo aman dipublikasikan dan mudah dipindah hosting/domain.

Script deploy saat ini ada di `deploy/aws/deploy.sh` dan mengasumsikan host Linux dengan:

- PHP-FPM 8.4.
- Composer.
- Node/npm.
- MySQL reachable dari app.
- Nginx.
- Supervisor.
- AWS CLI untuk flow SSM/S3.

## Yang Dilakukan Script Deploy

- Masuk maintenance mode.
- `rsync` source ke `DEPLOY_PATH`, sambil mempertahankan `.env`, storage persistent, cache/session/log.
- Set permission folder.
- Tambah trusted proxy Cloudflare ke `.env`.
- Sempitkan `SESSION_DOMAIN` parent-domain (mis. `.domain.tld`) menjadi host-only
  untuk domain canonical agar cookie session tidak terkirim ke subdomain lain.
- `composer install --no-dev`.
- `npm ci --ignore-scripts`.
- `npm run build`.
- `php artisan migrate --force`.
- `php artisan holidays:sync-id`.
- `php artisan storage:link`.
- Cache config, route, view, event.
- Install config Supervisor untuk queue, Reverb, scheduler.
- Restart proses Supervisor.
- Set upload limit PHP-FPM 8M/10M.
- Pasang include HSTS Nginx pada server block ISTURA yang melayani HTTPS atau root
  aplikasi agar static asset yang tidak melewati middleware Laravel tetap mengirim
  `Strict-Transport-Security`.
- Reload PHP-FPM dan Nginx.
- `php artisan up`.
- Health check `/up`.

Jika instalasi memang membutuhkan cookie lintas subdomain, set
`ISTURA_KEEP_LOOSE_SESSION_DOMAIN=true` pada environment proses deploy. Jika Nginx
dikelola manual dan tidak boleh disentuh script, set `ISTURA_MANAGE_NGINX_SECURITY_HEADERS=false`
lalu pastikan HSTS diterapkan sendiri pada seluruh response HTTPS-facing, termasuk
static asset.

## Deploy ke Server Istana / Hosting Baru

Jika server baru bukan AWS EC2 + SSM, jangan salin workflow mentah. Ambil requirement
runtime-nya:

- PHP 8.4 dengan ekstensi Laravel yang dibutuhkan.
- Composer.
- Node 22 dan npm.
- MySQL.
- Nginx/Apache mengarah ke folder `public/`.
- Supervisor/systemd untuk:
  - queue worker;
  - Reverb;
  - scheduler.
- Cron atau proses scheduler yang menjalankan `php artisan schedule:run` tiap menit, atau
  Supervisor program scheduler seperti repo saat ini.
- TLS/HTTPS aktif.
- `.env` production yang benar.
- `SESSION_DOMAIN` kosong untuk host persis; isi parent-domain hanya jika benar-benar
  perlu cookie lintas subdomain.
- HSTS aktif pada seluruh response HTTPS, termasuk file static dan halaman redirect yang
  dilayani web server/edge.
- Backup database dan storage.

## Command Production Umum

```bash
composer install --no-dev --prefer-dist --optimize-autoloader
npm ci --ignore-scripts
npm run build

php artisan migrate --force
php artisan storage:link
php artisan optimize:clear
php artisan config:cache
php artisan route:cache
php artisan view:cache
php artisan event:cache
```

## Health Check

Setelah deploy, minimal cek:

```bash
curl -fsS https://DOMAIN-BARU/up
curl -fsS https://DOMAIN-BARU/api/public/bootstrap
curl -fsS https://DOMAIN-BARU/robots.txt
curl -fsS https://DOMAIN-BARU/sitemap.xml
```

Lalu login admin, cek jadwal, cek realtime, dan pastikan upload surat/CMS masih bisa.

## Data Persisten

Jangan tertimpa saat deploy:

- `.env`
- `storage/app`
- `storage/framework/sessions`
- `storage/framework/cache`
- `storage/logs`
- `public/storage` symlink

## Rollback

Repo belum punya mekanisme release directory/symlink rollback. Jika hosting baru butuh rollback
cepat, rekomendasi teknisnya adalah memakai struktur release:

- `/path/to/istura/releases/<sha>`
- `/path/to/istura/shared/.env`
- `/path/to/istura/shared/storage`
- `/path/to/istura/current -> releases/<sha>`

Ini belum diimplementasikan di script saat ini.
