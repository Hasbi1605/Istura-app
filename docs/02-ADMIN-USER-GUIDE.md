# Panduan Admin dan Operator

Dokumen ini ditulis untuk pemakaian harian, bukan untuk coding.

## Login

1. Buka aplikasi.
2. Masuk ke mode admin.
3. Isi email dan password.
4. Jika 2FA aktif, isi kode authenticator atau recovery code.
5. Jika sesi habis, sistem akan meminta login ulang.

## Mengelola Booking

1. Buka menu Booking.
2. Gunakan filter status, tanggal, dan pencarian untuk menemukan permohonan.
3. Buka detail untuk melihat data pengunjung, jadwal, kloter, surat, dan catatan.
4. Gunakan aksi sesuai status:
   - Pending: setujui, tolak, tawarkan jadwal lain, pindah langsung, edit data, hapus.
   - Accepted: tandai selesai, tawarkan jadwal lain, pindah langsung, atur kloter, hapus.
   - Reschedule: konfirmasi/tolak/batalkan usulan.
   - Expired: tawarkan jadwal lain atau tutup kasus lewat tolak.
5. Salin pesan WhatsApp yang dihasilkan sistem dan kirim manual ke pengunjung.

## Atur Kloter dan Pindah Langsung

- Atur Kloter hanya mengubah pembagian peserta pada tanggal yang sama.
- Total peserta terkunci kecuali mode koreksi diaktifkan.
- Penggabungan slot berisiko atau overbook membutuhkan checkbox konfirmasi.
- Pindah Langsung mengubah jadwal tanpa alur persetujuan kedua; pastikan tamu sudah diberi tahu.

## Menandai Selesai dan Feedback

1. Klik Tandai selesai saat kunjungan sudah berlangsung/selesai.
2. Isi link dokumentasi opsional jika ada. Link harus HTTPS dan host-nya diizinkan env.
3. Sistem membuat pesan WhatsApp berisi link feedback.
4. Peserta dapat mengisi feedback sampai kuota `group_size` atau masa 14 hari habis.

## Mengelola Jadwal

- Menu Jadwal menampilkan slot default dan override.
- Slot berisi booking aktif dilindungi.
- H/H+1 default tertutup untuk publik.
- Jika admin membuka H/H+1, slot tampil ke publik hanya saat belum lewat dan marker pembukaan
  publik tersimpan.
- Untuk agenda besar, gunakan tutup/buka rentang tanggal.

## Mengelola CMS

CMS dapat mengubah konten publik tanpa deploy:

- FAQ.
- Kontak footer.
- Hero dan cerita.
- Landing page dan foto aktivitas.
- Copy wizard publik.
- Template WhatsApp.
- Surat/ketentuan kunjungan.

Setelah disimpan, cache publik akan dibump agar perubahan tampil.

## Istura Open

Istura Open dipakai untuk event perorangan/khusus:

1. Buat event dan tanggal.
2. Atur kuota, batas add-on, teks persetujuan, poster/copy promo jika perlu.
3. Isi link grup WhatsApp per hari sebelum membuka hari.
4. Aktifkan event.
5. Pantau pendaftar dan kuota.
6. Export pendaftar atau feedback jika dibutuhkan.
7. Arsipkan event setelah selesai.

Jika tanggal event masih punya booking rombongan aktif, sistem memberi peringatan konflik.
Admin harus mengakui konflik sebelum tetap membuka/mengaktifkan event.

## Audit Log dan Export

- Audit log menyimpan riwayat aksi penting.
- Viewer tidak mengakses audit log.
- Export tersedia untuk booking, feedback, laporan bulanan, poster mingguan, dan Istura Open.
