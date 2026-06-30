# Domain Migration Checklist

Gunakan dokumen ini saat ISTURA dipindah dari domain lama ke domain/hosting milik Istana.

## 1. Tentukan Domain Canonical

Contoh:

```text
https://istura.istanapresiden.go.id
```

Tentukan juga apakah memakai `www` atau non-`www`. Semua konfigurasi harus konsisten.

## 2. Update `.env` Production

```dotenv
APP_URL=https://DOMAIN-BARU
PUBLIC_CANONICAL_URL=https://DOMAIN-BARU
SEO_REDIRECT_TO_CANONICAL=true
SEO_REDIRECT_FROM_HOSTS=DOMAIN-LAMA-1,DOMAIN-LAMA-2

SESSION_SECURE_COOKIE=true
SESSION_DOMAIN=
SANCTUM_STATEFUL_DOMAINS=DOMAIN-BARU
CORS_ALLOWED_ORIGINS=https://DOMAIN-BARU

REVERB_HOST=DOMAIN-BARU
REVERB_PORT=443
REVERB_SCHEME=https
REVERB_ALLOWED_ORIGINS=DOMAIN-BARU

VITE_PUBLIC_APP_URL="${APP_URL}"
VITE_REVERB_HOST="${REVERB_HOST}"
VITE_REVERB_PORT="${REVERB_PORT}"
VITE_REVERB_SCHEME="${REVERB_SCHEME}"
```

Catatan:

- `REVERB_ALLOWED_ORIGINS` berisi host saja, bukan `https://`.
- `CORS_ALLOWED_ORIGINS` berisi origin penuh dengan skema.
- `SESSION_DOMAIN` boleh kosong jika aplikasi hanya satu host.

## 3. Update File Statis dan Kontak

- Cek `public/.well-known/security.txt` dan sesuaikan `Canonical` serta kontak.
- `public/robots.txt` tidak perlu ada sebagai file statis; route Laravel menghasilkan robots
  dari `App\Support\SeoMeta` berdasarkan `PUBLIC_CANONICAL_URL`.
- Pastikan logo/asset CMS tetap tersedia melalui `storage/app/public` dan `php artisan storage:link`.

## 4. DNS dan TLS

- A/AAAA/CNAME domain baru mengarah ke server/proxy baru.
- Sertifikat TLS aktif.
- Jika di belakang Cloudflare/reverse proxy, set `TRUSTED_PROXIES` sesuai proxy.
- Pastikan Nginx/Apache mengarah ke folder `public/`.

## 5. Rebuild Frontend Setelah Env Berubah

Variabel `VITE_*` masuk ke bundle frontend saat build. Setelah mengubah domain/Reverb:

```bash
npm run build
php artisan optimize:clear
php artisan config:cache
php artisan route:cache
php artisan view:cache
php artisan event:cache
```

## 6. Verifikasi URL Publik

```bash
curl -I https://DOMAIN-BARU/
curl -fsS https://DOMAIN-BARU/up
curl -fsS https://DOMAIN-BARU/api/public/bootstrap
curl -fsS https://DOMAIN-BARU/robots.txt
curl -fsS https://DOMAIN-BARU/sitemap.xml
```

Pastikan sitemap dan robots mengarah ke domain baru.

## 7. Verifikasi Admin

- Login admin.
- Jika 2FA aktif, verifikasi challenge.
- Buka dashboard.
- Cek Booking, Jadwal, Feedback, CMS, Istura Open.
- Tes upload file kecil jika memungkinkan.
- Cek Realtime aktif di admin.

## 8. Redirect Domain Lama

Jika domain lama masih diarahkan ke server yang sama, set `SEO_REDIRECT_FROM_HOSTS`.
Jika domain lama diarahkan ke server/proxy lain, redirect bisa dilakukan di Nginx/Cloudflare.

Target akhir:

- Domain lama → 301 ke canonical baru.
- Domain baru → 200.
- Canonical meta, OG URL, sitemap, dan robots semuanya memakai domain baru.

## 9. Search Console dan Kanal Resmi

- Tambahkan domain baru ke Google Search Console.
- Submit sitemap baru.
- Update link di kanal resmi, Instagram, Google Business Profile, dan dokumen internal.
- Pantau 404 dan redirect selama beberapa minggu.
