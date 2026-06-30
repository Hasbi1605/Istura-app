# Security Policy

## Supported Version

Repo ini mendokumentasikan sistem ISTURA saat ini. Perbaikan keamanan sebaiknya dilakukan
di branch utama yang aktif dipakai deployment production.

## Cara Melaporkan Isu

Untuk isu keamanan, jangan unggah data sensitif ke issue publik. Hubungi maintainer proyek
atau kanal internal Istana/Humas yang bertanggung jawab atas sistem. Jika memakai file
`public/.well-known/security.txt`, pastikan kontak dan canonical URL-nya ikut diperbarui
ketika domain berpindah.

## Data Sensitif

Jangan commit atau membagikan:

- `.env`, `.env.production`, atau backup env.
- Dump database production.
- NIK mentah, nomor WhatsApp massal, dan data pendaftar.
- Surat permohonan dari `storage/app/private/booking-letters/`.
- File upload CMS dari storage production bila berisi data internal.
- Secret Reverb, database, SMTP, AWS, Cloudflare, atau kredensial admin.

## Perlindungan yang Sudah Ada

- NIK disimpan terenkripsi; dedup memakai hash dan tampilan memakai masked value.
- Surat permohonan berada di storage privat dan diakses lewat endpoint admin.
- Login admin memakai Sanctum session, role, 2FA TOTP, trusted device, dan absolute session lifetime.
- Endpoint admin dipisah antara read-only viewer dan mutasi operator/super admin.
- Endpoint publik/auth memiliki rate limit.
- Upload divalidasi MIME dan ukuran maksimal 5 MB pada layer aplikasi.
- Security headers diterapkan oleh `app/Http/Middleware/AddSecurityHeaders.php`.
- Audit log mencatat aksi penting dengan konteks request.

## Checklist Sebelum Membuka Repo

- Pastikan tidak ada secret di history Git.
- Pastikan `.env*` production tidak tracked.
- Pastikan `database/seeders/data/admin_users.json` tidak berisi password.
- Pastikan dokumen deploy tidak membocorkan secret; identifier non-secret seperti path/instance
  boleh dipindah ke GitHub Variables bila repo dibuka lebih luas.
- Pastikan kontak `security.txt` sesuai pemilik operasional terbaru.
