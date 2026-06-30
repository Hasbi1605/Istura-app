# Handover ISTURA

Dokumen ini adalah pintu masuk untuk mentor magang, admin Istana, dan developer penerus.
Semua poin di bawah diringkas dari file repo saat ini, terutama `PRD-ISTURA-APP.md`,
`docs/CODEBASE-CONTEXT.md`, route Laravel, konfigurasi, dan script deploy.

## Status Sistem

- Status produk: live / production-ready.
- Bentuk aplikasi: monolit Laravel 13 + React 19 pada satu origin.
- Database: MySQL.
- Realtime: Laravel Reverb.
- Bahasa dan timezone: Indonesia, Asia/Jakarta.
- Deployment saat ini: GitHub Actions ke AWS EC2 via SSM, dengan script deploy di
  `deploy/aws/deploy.sh`.

## Pengguna Sistem

- Pengunjung publik: melihat informasi, cek jadwal, booking rombongan, mengisi feedback.
- Admin/operator: mengelola booking, jadwal, feedback, CMS, laporan, Istura Open.
- Super Admin: semua akses admin plus kelola akun admin.
- Viewer: akses baca, unduh dokumen, dan export; tidak bisa mutasi.

## Modul Utama

- Booking rombongan reguler.
- Jadwal kunjungan dan override slot/range.
- Feedback rombongan multi-submission.
- CMS landing page, FAQ, kontak, template WhatsApp, copy wizard.
- Istura Open untuk event perorangan berbasis kuota harian.
- Audit log, user admin, 2FA, export laporan.
- Halaman info SEO/GEO server-rendered.

## Dokumen yang Perlu Dibaca

- `README.md` untuk setup cepat dan peta dokumen.
- `PRD-ISTURA-APP.md` untuk requirement dan aturan bisnis lengkap.
- `IsturaOpen.md` untuk keputusan produk Istura Open.
- `docs/CODEBASE-CONTEXT.md` untuk peta file dan alur teknis.
- `docs/05-DEPLOYMENT.md` dan `docs/06-DOMAIN-MIGRATION.md` sebelum pindah server/domain.
- `docs/07-OPERATIONS-RUNBOOK.md` untuk pekerjaan harian/insiden.

## Serah Terima Minimal

- Akses GitHub repo dan branch `main`.
- Akses hosting/server production atau prosedur deploy baru.
- Akses database production dan prosedur backup/restore.
- Akses domain/DNS/TLS.
- Akses akun admin `super_admin` yang sudah dirotasi password-nya.
- Secret `.env` production yang tidak disimpan di repo.
- Akses kanal WhatsApp/kontak resmi yang dipakai operasional.

## Risiko Handover

- Deploy script saat ini masih spesifik AWS EC2 + SSM. Jika server Istana berbeda,
  gunakan docs deployment sebagai checklist, bukan salin mentah.
- Domain lama masih muncul di konfigurasi SEO/example karena production saat ini memakai
  `isturaiky.page`. Saat pindah domain, semua variabel canonical, CORS, Sanctum, Reverb,
  sitemap, robots, dan security.txt harus dicek bersama.
- Data produksi berisi PII. Jangan melakukan reset, seed ulang, atau export tanpa backup
  dan persetujuan pemilik data.

## Done Handover

- Developer baru bisa menjalankan `composer install`, `npm install`, `php artisan migrate --seed`,
  `php artisan test`, dan `npm run build`.
- Admin bisa login, memahami role, dan menjalankan alur booking/jadwal/feedback.
- Server baru punya `.env` production benar, queue/scheduler/Reverb aktif, storage link,
  TLS, backup, dan health check.
- Domain baru mengembalikan `/`, `/up`, `/api/public/bootstrap`, `/robots.txt`, dan
  `/sitemap.xml` dengan canonical yang benar.
