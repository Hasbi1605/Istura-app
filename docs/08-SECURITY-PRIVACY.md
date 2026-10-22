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

## Runtime PHP — PHP2Shell (CVE-2026-109618 / CVE-2026-109619, 21 Okt 2026)

Sumber resmi: php.net — *Security advisory: Critical remote code execution
vulnerabilities, update now* (21 Okt 2026,
https://www.php.net/archive/2026.php#2026-10-21-5), advisory
GHSA-w8hw-w9fx-j79w & GHSA-6wmf-4rv5-p3rp, rilis tetap 8.5.12 / 8.4.27 /
8.3.36 / 8.2.35. CVSS v4.0 9.2, **RCE tanpa autentikasi**, semua SAPI web
(PHP-FPM, mod_php, php-cgi, FrankenPHP, LiteSpeed). Ini bug di C-core PHP
(OOM `longjmp()` meninggalkan state parsial; stale global state/use-after-free
lintas request dalam satu worker) — **tidak bisa diperbaiki dari kode Laravel**;
hanya update runtime PHP yang menutupnya secara penuh.

Kondisi Istura saat advisory terbit: **rentan**. Tidak ada pin versi di repo —
CI hanya meminta `8.4`, `composer.json` hanya `^8.3`, deploy mengasumsikan
"PHP-FPM 8.4" tanpa cek patch level, dan PHP lokal 8.4.11 < 8.4.27. Istura
memang memproses multipart upload (surat booking publik, poster/CMS admin) dan
session — persis permukaan yang disebut advisory, tapi exploitability PHP-FPM
tetap bergantung keadaan worker; jangan menganggap FPM "aman".

Perbaikan yang diterapkan di repo:

- `composer.json`: `php` kini `^8.3.36 || ^8.4.27 || ^8.5.12` — runtime di
  bawah patch level tersebut gagal `composer install`/platform check.
- CI (`.github/workflows/deploy.yml`): pin `8.4.27` + langkah verifikasi
  `PHP_VERSION_ID >= 80427`.
- `deploy/aws/deploy.sh`: gate `require_patched_php_version` menolak deploy
  (sebelum maintenance mode / rsync) bila `php` server < 8.4.27; sesudah
  restart, `php8.4-fpm` wajib berstatus active. Override darurat hanya lewat
  env `ISTURA_MIN_PHP_VERSION` (jangan turunkan tanpa backport vendor terverifikasi).
- Defense-in-depth (bukan pengganti patch): FPM conf.d kini juga menetapkan
  `session.upload_progress.enabled = 0` untuk memutus jalur session upload
  progress yang terkonfirmasi pada CVE-2026-109619. Istura tidak memakai
  fitur itu. `memory_limit=-1` ala advisory **sengaja tidak diterapkan**:
  advisnya menyatakan itu bukan mitigasi lengkap, dan menghilangkan batas
  memori per-request membuka risiko DoS yang lebih nyata untuk app ini.
  Batas unggahan yang sudah konservatif tetap dipertahankan (app 5 MB,
  PHP 8M/10M) selaras anjuran `post_max_size` rendah untuk app ber-upload.

Yang masih harus dilakukan di **server production** (tidak bisa dari repo):
update paket PHP host ke 8.4.27+ (atau build distro dengan backport — nomor
versi distro bisa tetap lama; verifikasi lewat changelog paket vendor, bukan
hanya `php -v`), lalu restart PHP-FPM. Deploy berikutnya akan gagal di gate
versi bila belum diperbarui — itu disengaja. Saldo versi yang didukung PHP
untuk cabang lain bila pindah cabang: 8.3 ≥ 8.3.36, 8.5 ≥ 8.5.12, 8.2 ≥ 8.2.35.

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
