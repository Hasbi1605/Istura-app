# Security and Privacy

Dokumen ini menjelaskan perlindungan yang terlihat di repo saat ini.

## Data Pribadi

- NIK tidak disimpan sebagai plaintext.
- Model memakai NIK terenkripsi, NIK masked, dan NIK hash untuk dedup.
- Nomor WhatsApp dinormalisasi untuk dedup.
- Surat permohonan disimpan di storage privat.
- Export PDF booking dirancang tanpa NIK mentah.

## Auth Admin

- Login memakai Laravel Sanctum cookie session.
- Login dilindungi throttle dan progressive delay.
- 2FA TOTP tersedia dengan recovery code dan trusted device.
- Sesi admin punya absolute lifetime.
- Cookie session production sebaiknya host-only (`SESSION_DOMAIN=`) kecuali ada
  kebutuhan eksplisit berbagi sesi lintas subdomain.
- Role:
  - `viewer`: baca/export/download, tanpa mutasi dan tanpa audit log.
  - `admin`: operasional dan CMS.
  - `super_admin`: semua akses termasuk user admin.

## Authorization

- Route admin memakai middleware `admin-access`.
- Route mutasi dibungkus `operator`.
- Route user admin dibungkus `super-admin`.
- FormRequest dan policy juga mengecek role agar ada defense-in-depth.

## Rate Limit

Limiter yang terlihat:

- `auth-login`
- `two-factor`
- `public-bookings`
- `public-open`
- `public-schedule`
- `public-feedback-view`
- `public-feedback-submit`
- `public-open-feedback-view`
- `public-open-feedback-submit`

## Upload

- Surat, poster, dan gambar CMS divalidasi MIME/ukuran.
- CMS image diproses oleh `CmsImageService` dan dikonversi ke WebP.
- Batas aplikasi 5 MB; server PHP perlu limit sedikit lebih tinggi.

## Security Headers

`AddSecurityHeaders` mengatur:

- Content-Security-Policy.
- X-Frame-Options.
- X-Content-Type-Options.
- Referrer-Policy.
- Permissions-Policy.
- Strict-Transport-Security pada HTTPS/production.

Inline frame hanya dilonggarkan untuk preview dokumen admin same-origin.
Untuk deploy Nginx, `deploy/aws/deploy.sh` juga memasang include HSTS pada server
block ISTURA yang melayani HTTPS/root aplikasi agar file static yang tidak melewati
middleware Laravel tetap mengirim `Strict-Transport-Security`.

## Istura Open

- Link grup WhatsApp tidak dikirim di bootstrap publik.
- Link hanya muncul setelah registrasi/lookup yang cocok.
- Lookup/cancel publik membutuhkan NIK dan WhatsApp.
- Kuota dikunci atomik agar tidak overbooking.
- Hari tidak boleh dibuka tanpa link grup.

## Hal yang Perlu Dijaga

- Jangan log NIK mentah.
- Jangan membuat URL publik untuk surat permohonan.
- Jangan melonggarkan `DOCUMENTATION_LINK_HOSTS` tanpa alasan.
- Jangan membuka admin route tanpa middleware role.
- Jangan mematikan rate limit publik.
- Jangan seed user production dengan password tetap.
