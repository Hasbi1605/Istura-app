# Product Overview

ISTURA Web adalah sistem booking kunjungan Gedung Agung / Istana Kepresidenan Yogyakarta.
Sistem menggantikan proses manual menjadi alur online yang terdokumentasi dan tetap
memakai WhatsApp sebagai kanal komunikasi operasional.

## Publik

- Melihat landing page berisi informasi kunjungan, syarat, alur, aturan, contoh surat,
  FAQ, kontak, dan CTA booking.
- Melihat jadwal ketersediaan 2 bulan ke depan.
- Mengisi booking wizard 8 langkah: persiapan, contact person, instansi, jadwal, upload
  surat, review, pernyataan, selesai.
- Sistem melakukan precheck NIK/WhatsApp sebelum submit.
- Surat permohonan wajib untuk booking rombongan dan maksimal 5 MB.
- Setelah kunjungan Completed, peserta mengisi feedback lewat link token.
- Saat event Istura Open aktif, publik dapat daftar event perorangan tanpa surat dan
  memperoleh link grup WhatsApp setelah sukses mendaftar.

## Admin / Operator

- Login dengan email/password, 2FA bila aktif, dan absolute session lifetime.
- Dashboard KPI dan agenda.
- Kelola booking: accept, reject, reschedule, cancel reschedule, complete, pindah langsung,
  atur kloter, edit kontak, booking manual, unduh surat, dan hard delete dengan konfirmasi.
- Kelola jadwal: buka/tutup slot atau rentang, termasuk H/H+1 yang default tertutup untuk publik.
- Kelola feedback dan export Excel/PDF.
- Kelola CMS: FAQ, kontak, hero, landing page, surat, copy wizard, dan template WhatsApp.
- Kelola Istura Open: event, hari, kuota, link grup, pendaftar, feedback per hari, export,
  arsip/pulihkan, dan delete event nonaktif dengan guard.
- Viewer bisa membaca data dan export, tetapi tidak bisa mutasi.

## Super Admin

- Semua akses admin.
- Kelola user admin.

## Aturan Bisnis Kunci

- Booking publik normal paling cepat H+2 dan paling lambat 2 bulan ke depan.
- H/H+1 tertutup untuk publik kecuali admin membuka slot saat tanggal tersebut sudah berada
  di H/H+1 dan jam belum lewat.
- Kapasitas standar 80 orang per slot; rombongan besar dipecah menjadi kloter.
- Maksimal rombongan 480 orang per hari kunjungan.
- Operasional reguler produk Senin-Jumat; Sabtu, Minggu, dan tanggal merah default tertutup.
- Penutupan sementara di luar default, termasuk pada hari kerja tertentu, ditangani sebagai override jadwal operasional.
- Pending tidak kedaluwarsa berdasarkan umur pengajuan; hanya Expired saat jam kunjungan lewat.
- Feedback berlaku sampai 14 hari setelah Completed dan dapat diisi hingga `group_size` kali.
- Hard delete tidak memakai ulang kode booking.

## Batas Scope Saat Ini

- Tidak ada pembayaran.
- Tidak ada WhatsApp API otomatis; admin menyalin pesan dari template.
- Tidak ada check-in/scan lokasi.
- Tidak ada OTP publik.
