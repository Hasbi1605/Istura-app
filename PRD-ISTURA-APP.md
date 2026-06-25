# PRD — Project Requirements Document

**Produk:** ISTURA Web — Sistem Booking Kunjungan Istana Untuk Rakyat (Yogyakarta)
**Versi dokumen:** 1.0
**Status:** Live (production-ready)
**Bahasa aplikasi:** Indonesia
**Terakhir diperbarui:** Juni 2026

---

## 1. Overview

### 1.1 Ringkasan Produk

ISTURA Web adalah aplikasi monolit Laravel + React untuk mengelola kunjungan publik ke
**Istana Kepresidenan Yogyakarta (Gedung Agung)** melalui program "Istana Untuk Rakyat
(ISTURA)". Aplikasi melayani dua kelompok pengguna utama:

1. **Publik / Pengunjung (rombongan instansi, sekolah, komunitas, organisasi)** — mendaftar
   kunjungan melalui form booking online, mengunggah surat permohonan, lalu menunggu
   konfirmasi admin via WhatsApp. Setelah kunjungan, pengunjung mengisi feedback melalui
   tautan unik.
2. **Admin & Super Admin (Humas Gedung Agung)** — mengelola permohonan booking, mengatur
   jadwal/slot kunjungan, memantau feedback, mengelola konten situs (CMS), mengelola akun
   admin, dan meninjau riwayat aktivitas (audit log).

Aplikasi adalah Single Page Application (SPA) React yang dihosting pada satu origin dengan
backend Laravel. Data disimpan di MySQL. Pembaruan dashboard admin bersifat realtime melalui
WebSocket (Laravel Reverb).

### 1.2 Tujuan Produk

- Menggantikan proses booking manual (WhatsApp/telepon) dengan alur terstruktur dan
  terdokumentasi.
- Mencegah bentrok jadwal dan overbooking slot kunjungan secara otomatis.
- Memberi admin alat operasional terpusat: persetujuan, reschedule, pembagian kloter,
  ekspor laporan, dan pengelolaan konten publik.
- Menjaga keamanan data pribadi pengunjung (NIK terenkripsi, surat permohonan privat).

### 1.3 Target Pengguna

| Persona | Deskripsi | Kebutuhan Utama |
|---------|-----------|-----------------|
| Contact person rombongan | Perwakilan instansi/sekolah/komunitas | Booking mudah, jadwal jelas, konfirmasi cepat |
| Admin Humas | Operator harian | Kelola booking, jadwal, feedback, konten |
| Super Admin | Penanggung jawab sistem | Semua akses admin + kelola pengguna admin |

### 1.4 Istilah Kunci (Glosarium)

- **Booking / Permohonan:** satu pengajuan kunjungan rombongan.
- **Kloter / Segment:** pembagian rombongan besar ke beberapa slot jam (kapasitas 80/slot).
- **Slot:** kombinasi tanggal + jam kunjungan dengan status tertentu.
- **Override jadwal:** modifikasi manual admin terhadap slot default (tutup/buka/hold).
- **Feedback token:** kode unik per booking untuk akses form feedback pasca-kunjungan.
- **Horizon jadwal:** rentang kalender yang ditampilkan ke publik (H-2 s/d +2 bulan).

---

## 2. Requirements

### 2.1 Functional Requirements — Publik

| ID | Requirement |
|----|-------------|
| FR-P1 | Pengunjung dapat melihat landing page berisi info jam kunjungan, syarat, alur booking, aturan, contoh surat, FAQ, dan kontak. |
| FR-P2 | Pengunjung dapat melihat jadwal/kalender ketersediaan slot 2 bulan ke depan tanpa login. |
| FR-P3 | Pengunjung dapat mengajukan booking melalui wizard bertahap (8 langkah) dengan validasi tiap langkah. |
| FR-P4 | Sistem melakukan precheck identitas (NIK/WhatsApp) sebelum submit untuk mencegah pelanggaran batas booking aktif. |
| FR-P5 | Pengunjung wajib mengunggah surat permohonan (PDF/JPG/JPEG/PNG, maks 5 MB). |
| FR-P6 | Pengunjung menerima kode booking unik (format ISTURA-YYYY-NNNN) setelah submit berhasil. |
| FR-P7 | Peserta dapat mengisi feedback setelah kunjungan berstatus Completed, via tautan token unik, hingga kuota `group_size` booking terpenuhi dan periode 14 hari belum berakhir. |
| FR-P8 | Draft form booking disimpan otomatis di browser (autosave) agar tidak hilang saat refresh. |

### 2.2 Functional Requirements — Admin

| ID | Requirement |
|----|-------------|
| FR-A1 | Admin dapat login dengan email + password; sistem menerapkan progressive delay pada percobaan gagal. |
| FR-A2 | Admin dapat (opsional/wajib) mengaktifkan Two-Factor Authentication (TOTP) dengan recovery codes & trusted device. |
| FR-A3 | Admin dapat melihat dashboard berisi KPI (pending, booking hari ini/minggu/bulan, total selesai, jumlah & rata-rata feedback). |
| FR-A4 | Admin dapat melihat daftar booking dengan filter status, rentang tanggal, pencarian, dan paginasi. |
| FR-A5 | Admin dapat menyetujui (accept), menolak (reject), menjadwalkan ulang (reschedule), membatalkan usulan reschedule, dan menandai selesai (complete) sebuah booking. |
| FR-A6 | Admin dapat menggabungkan/memecah pembagian kloter pada tanggal yang sama. Total peserta terkunci secara default; koreksi total harus diaktifkan eksplisit. Overbook manual, koreksi total, serta kloter >80 wajib memakai checkbox konfirmasi dan menghasilkan catatan audit otomatis. |
| FR-A7 | Admin dapat mengunduh surat permohonan booking (inline preview atau download). |
| FR-A8 | Admin dapat mengelola jadwal: menutup/membuka slot tertentu, dan menutup/membuka rentang tanggal. |
| FR-A9 | Admin dapat melihat & mengekspor feedback. |
| FR-A10 | Admin dapat mengelola konten CMS: FAQ, ketentuan/surat, kontak footer, hero & cerita, landing page, template pesan WhatsApp. |
| FR-A11 | Admin dapat menyalin pesan WhatsApp tergenerasi (berbasis template per status) untuk dikirim ke pengunjung. |
| FR-A12 | Admin dapat mengekspor data booking (Excel/PDF/ZIP), laporan bulanan, dan poster mingguan. |
| FR-A13 | **Super Admin** dapat mengelola akun admin (buat, ubah, hapus). |
| FR-A14 | Admin dapat melihat riwayat aktivitas (audit log) dengan filter. |
| FR-A15 | Admin dapat melihat H/H+1 di halaman jadwal admin dalam kondisi default tertutup, lalu membuka/menutup slot tersebut dengan toggle jadwal biasa. Slot H/H+1 yang dibuka admin tampil ke publik selama jam belum lewat. Admin juga dapat membuat booking tamu khusus dengan surat permohonan opsional serta memindahkan booking aktif langsung ke jadwal H/H+1 setelah persetujuan tamu. |
| FR-A16 | Admin dapat menghapus permanen booking di semua status melalui modal konfirmasi ketik kode. Sistem menghapus booking, slot, surat, dan feedback terkait; audit log tetap tersimpan dan nomor kode booking tidak dipakai ulang. |

### 2.3 Non-Functional Requirements

| ID | Kategori | Requirement |
|----|----------|-------------|
| NFR-1 | Keamanan | NIK disimpan terenkripsi (Laravel Crypt); hanya `nik_masked` & `nik_hash` untuk tampilan/dedup. |
| NFR-2 | Keamanan | Surat permohonan disimpan privat di `storage/app/private/booking-letters/`, diakses hanya via endpoint admin terautentikasi. |
| NFR-3 | Keamanan | Endpoint publik dibatasi rate-limit (booking, feedback view/submit, schedule, login, 2FA). |
| NFR-4 | Keamanan | Session admin punya absolute lifetime (default 720 menit); auto-logout saat kedaluwarsa. |
| NFR-5 | Keamanan | Security headers ditambahkan di seluruh respons (middleware AddSecurityHeaders). |
| NFR-6 | Konkurensi | Pemesanan slot menggunakan transaksi DB + `booking_slot_locks`; overbook hanya boleh melalui aksi admin eksplisit dan tercatat di audit. Booking publik H/H+1 hanya boleh lolos bila slot dibuka admin lewat override jadwal biasa dan tetap dikunci ulang saat submit. |
| NFR-7 | Realtime | Perubahan booking/jadwal dipancarkan via WebSocket; dashboard admin auto-update. Dapat dimatikan via `VITE_REVERB_ENABLED=false` (degradasi anggun). |
| NFR-8 | Lokalisasi | Seluruh teks UI & tanggal dalam Bahasa Indonesia, timezone Asia/Jakarta. |
| NFR-9 | Aksesibilitas | Komponen interaktif harus accessibility-compliant (role, aria, focus trap pada modal). |
| NFR-10 | Performa | Data publik (jadwal, CMS) di-cache dengan TTL & versi cache yang di-bump saat perubahan. |

### 2.4 Aturan Bisnis (Business Rules)

| ID | Aturan |
|----|--------|
| BR-1 | Booking publik normal paling cepat **H+2** dan paling lambat **2 bulan** ke depan. H/H+1 default tertutup untuk publik dan hanya tampil bila admin membuka slot lewat toggle jadwal biasa sebelum jam kunjungan lewat. Admin dapat memakai H/H+1 melalui Booking Manual atau pindah jadwal langsung. |
| BR-2 | Kapasitas standar per slot jam (kloter) = **80 orang**. Rombongan >80 dipecah otomatis; admin dapat menggabungkan kloter >80 dengan konfirmasi operasional dan audit. |
| BR-3 | Jumlah rombongan: minimal 1, maksimal **480 orang** per hari kunjungan. |
| BR-4 | NIK wajib 16 digit angka. WhatsApp wajib format `08...` atau `628...` (8–13 digit setelah prefix). |
| BR-5 | Jam operasional default: **Senin–Kamis**, slot 08.00, 09.00, 10.00, 11.00, 13.00, 14.00. Jam 12.00 = istirahat (tidak tersedia). |
| BR-6 | **Jumat, Sabtu, Minggu** dan **tanggal merah nasional** otomatis tertutup (Closed). |
| BR-7 | Satu identitas (NIK atau WhatsApp) dibatasi jumlah booking aktif bersamaan (konfigurasi `PUBLIC_BOOKING_ACTIVE_IDENTITY_LIMIT`). |
| BR-8 | Booking Pending kedaluwarsa otomatis hanya bila jam kunjungan sudah terlewat. Tidak ada TTL umur pengajuan; Pending tetap menahan slot sampai admin memproses atau jadwalnya lewat. |
| BR-9 | Feedback dapat dikirim hingga `group_size` kali per booking, hanya setelah status Completed, dan hanya sampai `feedback_expires_at` (default `completed_at + 14 hari`). |
| BR-10 | Booking tidak dapat ditandai Completed sebelum tanggal kunjungan. |
| BR-11 | Hard delete booking tidak menurunkan `booking_sequences`; kode yang sudah pernah dibuat menjadi jejak audit dan tidak boleh dipakai ulang meskipun bookingnya dihapus. |

---

## 3. Core Features

### 3.1 Landing Page Publik
Halaman utama informatif berisi: navigasi, hero dengan pemandu virtual "MIKY", kartu info
cepat (jam, syarat, konfirmasi), kalender jadwal, video virtual tour, langkah booking (4
langkah), aktivitas kunjungan, aturan & tata tertib, contoh surat permohonan, FAQ, CTA, dan
footer dengan kontak & peta lokasi. Seluruh konten dikelola via CMS admin.

### 3.2 Booking Wizard (8 Langkah)
Form pendaftaran bertahap dengan pemandu MIKY di tiap langkah:
1. **Selamat Datang** — persiapan data.
2. **Data Contact Person** — nama, NIK, WhatsApp.
3. **Data Instansi** — nama instansi, jumlah rombongan; rombongan >80 melihat rincian kloter dan CTA diskusi awal dengan admin.
4. **Pilih Jadwal** — tanggal & jam dari slot tersedia (live status); untuk rombongan >80, setelah jam dipilih tampil card horizontal diskusi penyesuaian kloter via WhatsApp di bawah kalender dan daftar jam.
5. **Upload Surat** — surat permohonan (PDF/JPG/PNG, ≤5 MB).
6. **Review Data** — verifikasi seluruh isian.
7. **Pernyataan** — persetujuan kebenaran data & aturan.
8. **Selesai** — kode booking + status Pending.

Fitur pendukung: precheck identitas saat lanjut, autosave draft, pembagian kloter otomatis
untuk rombongan besar.

### 3.3 Manajemen Booking (Admin)
Tabel booking dengan filter (status, rentang tanggal, sort), pencarian (kode/nama/instansi),
mode tampilan (split/table), dan aksi siklus hidup: accept, reject, reschedule, cancel
reschedule, complete, ubah kloter (segments), pindah jadwal langsung, buat Booking Manual,
dan unduh surat. **Atur Kloter** hanya mengubah alokasi jam pada tanggal yang sama dan menjaga
total peserta kecuali mode koreksi diaktifkan. **Pindah Jadwal Langsung** dapat memilih H/H+1,
menolak jam hari ini yang sudah lewat, dan hanya tersedia untuk booking Pending/Accepted.
Pada booking Accepted, admin menerima peringatan bahwa jadwal langsung berubah dan tamu harus
sudah diberi tahu; booking berstatus Reschedule tetap diselesaikan melalui alur penjadwalan ulang.
Pindah Jadwal Langsung mempertahankan bentuk kloter aktif saat ini, mengunci jadwal aktif agar tidak bisa dipilih ulang sebagai tujuan, dan menyimpan perubahan tanpa membuka WhatsApp otomatis. Booking Manual
dapat dibuat tanpa surat atau dengan surat permohonan opsional, tetap mengenkripsi NIK,
menampilkan label tanggal ringkas berdasarkan slot kosong/penuh/tidak ada jam operasional,
menyediakan mode kloter otomatis atau manual pada tanggal yang sama, menampilkan izin gabung
slot terisi sebagai item konfirmasi ringkas, dan menyimpan langsung tanpa membuka WhatsApp otomatis. Tawarkan Jadwal
Lain hanya menampilkan tanggal yang benar-benar memiliki slot tersedia untuk ditawarkan ke tamu. Hard delete booking
tersedia untuk semua status melalui modal konfirmasi ketik kode; aksi ini membersihkan slot, surat, dan feedback terkait,
tetapi mempertahankan audit log dan tidak memakai ulang kode booking. Aksi lifecycle utama tetap menghasilkan pesan WhatsApp siap kirim dan audit.

### 3.4 Manajemen Jadwal H/H+1 (Admin)
Admin melihat hari H/H+1 di Jadwal Kunjungan dalam kondisi default tertutup untuk publik.
Jika operasional mengizinkan, admin membuka atau menutup slot H/H+1 dengan toggle slot/range
jadwal biasa. Slot H/H+1 yang dibuka admin tampil di landing page dan Booking Wizard selama
jam kunjungan belum lewat; bila ditutup kembali, slot hilang dari pilihan publik. Tidak ada
kapasitas atau tenggat terpisah di luar status slot jadwal.

### 3.5 Manajemen Jadwal (Admin)
Grid kalender dengan status per slot (Available, Held, Booked, Closed, Reschedule Hold).
Admin dapat menutup/membuka slot tunggal atau rentang tanggal (mis. menutup pekan event).
Status default dihitung runtime; hanya override yang disimpan. Integrasi auto-sync tanggal
merah nasional dari provider eksternal.

### 3.6 Feedback Kunjungan
Setelah booking Completed, pengunjung menerima tautan feedback unik (token). Token berlaku
14 hari sejak `completed_at` dan dapat dipakai hingga `group_size` peserta; setelah kuota
terpenuhi atau periode berakhir, form ditutup. Form menilai kemudahan booking, pelayanan,
kualitas pemandu, kebersihan/kenyamanan fasilitas, rekomendasi (skala 1–5), riwayat
kunjungan, sumber mengetahui ISTURA, highlight, area perbaikan, komentar, dan izin
publikasi. Highlight dan area perbaikan masing-masing dibatasi maksimal 12 item dengan
panjang 80 karakter per item. Admin melihat & mengekspor feedback.

### 3.7 CMS (Content Management)
Admin mengelola seluruh konten publik tanpa deploy: FAQ, ketentuan kunjungan/surat, kontak
footer, hero & cerita, landing page (seksi-seksi), copy wizard booking/feedback, dan template
pesan WhatsApp per status booking (Pending, Accepted, Rejected, Reschedule, Completed,
Expired).

### 3.8 Autentikasi & Keamanan Admin
Login email+password (Sanctum SPA session), progressive delay anti-bruteforce, Two-Factor
Authentication TOTP dengan recovery codes & trusted devices, absolute session lifetime,
peran super_admin/admin.

### 3.9 Dashboard & Pelaporan
KPI ringkas, booking hari ini, feedback terbaru. Ekspor: data booking (Excel/PDF/ZIP),
laporan bulanan, poster jadwal mingguan. Realtime update via WebSocket.

### 3.10 Audit Log
Pencatatan otomatis seluruh aksi penting (booking baru, perubahan status, feedback, dll)
dengan aktor, target, payload, dan konteks request. Retensi dipangkas otomatis (default 180
hari).

### 3.11 Istura Open
Modul pendaftaran perorangan berbasis kuota harian, terpisah dari booking rombongan dan
sudah diimplementasikan. Admin dapat memilih satu atau beberapa tanggal (termasuk tanggal
tidak berurutan), mengatur kuota/link grup per hari, mengaktifkan satu event, memantau,
membatalkan, dan mengekspor pendaftar, mengarsipkan/memulihkan event yang sudah tidak operasional, serta
menghapus draft event nonaktif yang belum pernah memiliki pendaftar. Event yang sudah lewat
atau diarsipkan tidak tampil di publik dan bersifat baca-saja untuk mutasi operasional di UI
dan API. Saat window pendaftaran sudah ditutup tetapi event masih aktif/belum lewat, pendaftar
lama tetap bisa lookup link grup atau self-cancel dengan NIK + WhatsApp. Event baru tidak dapat
dibuat dengan tanggal lampau; edit event berjalan tetap dapat mempertahankan tanggal lampau yang
sudah ada, tetapi tidak dapat menambahkan tanggal lampau baru. Detail aturan ada di `IsturaOpen.md`.
Aktivasi event memperingatkan admin bila tanggal yang dibuka untuk Istura Open masih memiliki
booking rombongan aktif; admin harus mengakui konflik sebelum event benar-benar aktif. Pendaftar
Istura Open tidak dipindah hari dari admin karena link grup WhatsApp diberikan langsung saat daftar.

---

## 4. User Flow

### 4.1 User Flow — Publik (Pengunjung)

#### 4.1.1 Flow: Melihat Informasi & Jadwal
```
1. Pengunjung membuka aplikasi (halaman home).
2. Sistem memuat bootstrap publik (jadwal, FAQ, kontak, template WA, hero, surat, konten situs).
3. Pengunjung menelusuri seksi: info cepat → jadwal → video → langkah booking → aktivitas
   → aturan → contoh surat → FAQ → CTA → footer.
4. Pada seksi jadwal, pengunjung melihat kalender 2 bulan ke depan:
   - Slot Available (gold) = bisa dipilih.
   - Slot abu-abu = terisi (Held/Booked) / tertutup (Closed) / di luar rentang.
   - Hari libur nasional & akhir pekan ditandai tertutup dengan alasan.
5. Pengunjung klik "Mulai Booking" → masuk Booking Wizard.
```

#### 4.1.2 Flow: Pengajuan Booking (Happy Path)
```
1. Pengunjung klik "Mulai Booking" dari navigasi/CTA.
2. Langkah 1 (Selamat Datang): membaca persiapan → klik Lanjut.
3. Langkah 2 (Contact Person): isi Nama, NIK (16 digit), WhatsApp (08../628..) → Lanjut.
   → Sistem precheck identitas: bila sudah mencapai batas booking aktif → tampilkan error,
     tidak bisa lanjut.
4. Langkah 3 (Instansi): isi Nama Instansi, Jumlah Rombongan (1–480) → bila >80,
   rincian kloter dan CTA diskusi awal dengan admin ditampilkan → Lanjut.
5. Langkah 4 (Pilih Jadwal): pilih Tanggal (H-2 s/d +2 bulan) & Jam dari slot Available.
   → Bila rombongan > 80, sistem menyiapkan pembagian kloter otomatis ke slot berurutan.
   → Setelah jam dipilih, card penyesuaian horizontal ditampilkan di bawah kalender dan
     daftar jam. Pengunjung dapat membuka WhatsApp berisi instansi, jumlah peserta, tanggal,
     dan rincian kloter untuk meminta peninjauan manual. Permintaan tidak menjamin
     penggabungan; admin menilai ketersediaan jadwal dan kebutuhan operasional.
6. Langkah 5 (Upload Surat): unggah file PDF/JPG/JPEG/PNG ≤ 5 MB → Lanjut.
7. Langkah 6 (Review): periksa seluruh data → Lanjut.
8. Langkah 7 (Pernyataan): centang persetujuan → klik Kirim Permohonan.
9. Sistem memvalidasi ulang, mengunci slot (transaksi DB), menyimpan booking status Pending,
   menyimpan surat privat, dan mencatat audit log + broadcast realtime ke admin.
10. Langkah 8 (Selesai): tampilkan kode booking (ISTURA-YYYY-NNNN) + pesan "admin menghubungi
    maksimal 1x24 jam via WhatsApp".
```

#### 4.1.3 Flow: Booking — Skenario Alternatif / Error
```
- Slot direbut pengguna lain saat submit → error "slot tidak tersedia", pengguna pilih slot lain.
- NIK/WhatsApp melebihi batas booking aktif → error pada langkah Contact Person.
- File surat > 5 MB atau format salah → error validasi upload.
- Tanggal < H-2 atau > 2 bulan → error validasi tanggal.
- Jam 12.00 dipilih → ditolak (waktu istirahat).
- Refresh browser di tengah wizard → draft ter-restore otomatis (autosave).
```

#### 4.1.4 Flow: Mengisi Feedback Pasca-Kunjungan
```
1. Admin menandai booking Completed → menyalin pesan WA berisi tautan feedback unik.
2. Pengunjung menerima pesan WA → membuka tautan feedback (berisi kode + token).
3. Sistem memvalidasi kode + token + status Completed + periode 14 hari + sisa kuota.
   → Token salah / status belum Completed / kuota penuh / periode berakhir → tampilkan error.
4. Pengunjung mengisi wizard 4 langkah: penilaian inti; kualitas pemandu + fasilitas +
   riwayat kunjungan + sumber informasi; rekomendasi + highlight/perbaikan; komentar +
   izin publikasi.
5. Pengunjung submit → sistem menyimpan feedback (maksimal `group_size` kali per booking)
   + audit log.
6. Tampilkan konfirmasi terima kasih.
```

### 4.2 Admin Flow

#### 4.2.1 Flow: Login Admin (+ 2FA)
```
1. Admin membuka aplikasi → mode admin → form login.
2. Admin isi email + password → submit.
   → Kredensial salah → error; setelah 3x gagal → progressive delay (2^n detik, maks 5 menit).
   → Akun nonaktif (email belum terverifikasi) → ditolak.
3. Login sukses:
   → Jika 2FA aktif & belum diverifikasi sesi → respons requires_2fa=true → tampilkan
     Two-Factor Challenge.
        a. Admin masukkan kode TOTP (atau recovery code).
        b. Opsi "percayai perangkat ini" → trusted device tersimpan.
   → Jika 2FA tidak aktif → langsung masuk dashboard.
4. Sesi admin dimulai (absolute lifetime 720 menit). Saat kedaluwarsa → auto-logout.
```

#### 4.2.2 Flow: Setup Two-Factor Authentication
```
1. Admin buka pengaturan 2FA → klik Setup.
2. Sistem menghasilkan secret + QR code → admin scan via authenticator app.
3. Admin masukkan kode konfirmasi → 2FA confirmed.
4. Sistem menampilkan recovery codes (sekali) → admin simpan.
5. Opsional: regenerate recovery codes, disable 2FA (dengan verifikasi).
```

#### 4.2.3 Flow: Mengelola Booking (Siklus Hidup)
```
1. Admin buka menu Booking → tabel booking termuat (filter status/tanggal, cari, paginasi).
2. Admin pilih satu booking → lihat detail (data, kloter, surat).
3. Aksi yang tersedia bergantung status:
   - Pending  → Accept | Reject | Reschedule
   - Accepted → Complete | Reschedule
   - Reschedule → Accept (konfirmasi usulan) | Reject | Reschedule | Cancel Reschedule
   - Expired  → Reschedule | Reject
4. ACCEPT: validasi jadwal belum lewat → status Accepted → salin pesan WA "disetujui".
5. REJECT: status Rejected → salin pesan WA "ditolak" (catatan alasan).
6. RESCHEDULE: admin pilih tanggal+jam usulan baru → status Reschedule (jadwal lama tetap
   tertahan, usulan baru disiapkan) → salin pesan WA "usulan reschedule".
7. CANCEL RESCHEDULE: kembalikan ke status sebelumnya (Accepted/Pending) → salin pesan WA.
8. COMPLETE: hanya bila tanggal kunjungan ≤ hari ini → status Completed → salin pesan WA
   berisi tautan feedback.
9. UBAH KLOTER (segments): admin susun ulang pembagian peserta ke slot; total peserta harus
   sama; overbook/penggabungan kloter besar/perubahan jumlah → checkbox konfirmasi wajib
   dan catatan audit dibuat otomatis.
   Booking Manual dapat memakai pembagian otomatis berurutan atau pembagian manual per jam;
   total peserta manual harus sama dengan jumlah peserta booking dan seluruh kloter berada
   pada tanggal booking.
10. UNDUH SURAT: admin preview inline atau download surat permohonan.
11. Setiap aksi tercatat di audit log & memicu broadcast realtime + invalidasi cache jadwal.
```

#### 4.2.4 Flow: Mengelola Jadwal
```
1. Admin buka menu Jadwal Kunjungan → grid kalender dengan status slot.
2. Tutup/buka SLOT tunggal: pilih tanggal+jam → set status (Closed/Available/Held) + catatan.
3. Tutup/buka RENTANG tanggal: pilih rentang → set status (mis. Closed untuk event) + catatan.
4. Hapus override slot → kembali ke perhitungan default.
5. Slot yang sudah punya booking aktif tidak bisa ditutup sembarangan (terlindungi).
6. Perubahan memicu broadcast ScheduleUpdated & invalidasi cache publik.
```

#### 4.2.5 Flow: Mengelola Konten (CMS)
```
1. Admin buka grup menu "Konten Web".
2. Pilih sub-menu: FAQ | Ketentuan Kunjungan | Kontak Footer | Hero & Cerita | Landing Page
   | Template Pesan WA.
3. Edit konten dalam editor → simpan.
4. Untuk Landing Page, admin juga dapat mengubah copy fixed-flow Wizard Publik (booking
   reguler dan feedback) tanpa mengubah urutan step atau aturan validasi.
5. Sistem menyimpan ke site_settings/tabel terkait, mencatat audit log, dan mem-bump cache
   publik sehingga perubahan langsung tampil di landing page/wizard publik.
```

#### 4.2.6 Flow: Mengelola Pengguna Admin (Super Admin only)
```
1. Super Admin buka menu Pengguna Admin (menu tidak tampil untuk admin biasa).
2. Lihat daftar admin → Buat / Ubah / Hapus akun.
   - Buat: nama, email, password, role (admin/super_admin), telepon.
   - Hapus/ubah tunduk pada aturan (mis. tidak menonaktifkan diri sendiri secara tidak sah).
3. Perubahan tercatat di audit log.
```

#### 4.2.7 Flow: Dashboard, Feedback & Audit
```
- Dashboard: admin melihat KPI, booking hari ini, feedback terbaru — auto-refresh realtime.
- Feedback: admin melihat daftar feedback, detail, dan ekspor.
- Audit: admin melihat riwayat aktivitas dengan filter (aktor, aksi, tanggal).
- Ekspor: booking (Excel/PDF/ZIP), laporan bulanan, poster mingguan.
```

### 4.3 State Diagram — Status Booking
```
            ┌──────────┐  accept   ┌──────────┐  complete  ┌───────────┐
  submit →  │ Pending  │ ───────→  │ Accepted │ ─────────→ │ Completed │ → feedback
            └────┬─────┘           └────┬─────┘            └───────────┘
                 │ reject              │ reschedule
                 ▼                     ▼
            ┌──────────┐         ┌──────────────┐ accept → Accepted
            │ Rejected │         │  Reschedule  │ cancel → (status sebelumnya)
            └──────────┘         └──────┬───────┘ reject → Rejected
                 ▲                      │ (usulan lewat)
     (lewat)     │                      ▼
            ┌──────────┐          (Expired / status pulih)
  Pending → │ Expired  │ → reschedule | reject
            └──────────┘
```

### 4.4 State — Status Slot Jadwal
```
Available      → slot terbuka, bisa dipesan publik
Held           → slot ditahan booking Pending
Booked         → slot terisi booking Accepted
Reschedule Hold→ slot ditahan usulan reschedule
Closed         → slot tertutup (default akhir pekan/libur, atau override admin)
```

---

## 5. Architecture

### 5.1 Tech Stack

| Layer | Teknologi |
|-------|-----------|
| Backend | Laravel 13 (PHP 8.4) |
| Database | MySQL (utf8mb4_unicode_ci) |
| Autentikasi | Laravel Sanctum (SPA cookie session) |
| Realtime | Laravel Reverb (WebSocket) + laravel-echo / pusher-js |
| Frontend | React 19 + TypeScript + Vite |
| Animasi / UI | GSAP, lucide-react |
| Ekspor (browser) | pdfmake (PDF), exceljs (XLSX), jszip (ZIP) |
| Cache / Queue | database driver (cache, queue, session) |
| Penyimpanan file | local disk (`storage/app/private`) |

### 5.2 Pola Arsitektur

- **Monolit satu origin:** Laravel menghosting SPA React (`resources/views/app.blade.php`)
  dan melayani REST API + WebSocket. Semua rute non-API (`/{any}`) diserahkan ke router
  berbasis state React.
- **Thin controllers + Services:** logika domain terpusat di `app/Services`
  (`BookingService`, `ScheduleService`, `TwoFactorService`, `NationalHolidaySyncService`,
  `BookingCodeGenerator`, `AuditLogger`). Controller hanya orkestrasi.
- **FormRequest validation:** validasi per-action di `app/Http/Requests`.
- **API Resources:** bentuk JSON camelCase (mirror tipe React) di `app/Http/Resources`.
- **Events & Broadcasting:** `BookingCreated`, `BookingStatusChanged`, `BookingDeleted`, `FeedbackSubmitted`,
  `ScheduleUpdated` disiarkan via Reverb.
- **Caching publik:** `PublicCache` me-remember jadwal & konten CMS dengan TTL + versi cache
  yang di-bump saat data berubah.

### 5.3 Struktur API (Ringkas)

**Public** (`/api/public`, dengan rate-limit per grup)
```
GET  /bootstrap                  # paket awal: schedule, faqs, contacts, waTemplates, hero, letter, siteContent
GET  /faqs | /contacts | /schedule | /hero | /letter | /site-content
GET  /wa-templates | /wa-templates/{status}
POST /bookings/precheck          # cek identitas (throttle:public-bookings)
POST /bookings                   # submit booking (throttle:public-bookings)
GET  /feedback/{code}            # validasi akses feedback by code+token (throttle:public-feedback-view)
POST /feedback/{code}            # submit feedback (throttle:public-feedback-submit)
```

**Auth** (`/api/auth`)
```
POST /login                      # throttle:auth-login + progressive delay
POST /logout                     # auth:sanctum
GET  /me
GET  /two-factor/status
POST /two-factor/{setup,confirm,verify,disable,recovery-codes}   # throttle:two-factor
GET  /two-factor/challenge
```

**Admin** (`/api/admin`, middleware `admin-access`)
```
GET  /dashboard
GET  /bookings | /bookings/{code}
POST /bookings/{code}/{accept,reject,reschedule,reschedule/cancel,segments,complete}
DELETE /bookings/{code}
GET  /bookings/{code}/document
GET  /schedule ; POST /schedule/slot ; DELETE /schedule/slot ; POST /schedule/range
GET  /feedback | /feedback/{feedback}
GET/PUT/POST /cms/{faqs,contacts,wa-templates,hero,letter,site-content}
GET  /audit-logs
# Super Admin only (middleware super-admin):
GET/POST/PUT/DELETE /users
```

**Realtime Channels** (`routes/channels.php`)
```
private-admin.bookings           # hanya user admin (broadcast booking & jadwal)
public.schedule                  # perubahan jadwal publik
public.open                      # kuota/status/copy Istura Open
```

### 5.4 Middleware Keamanan

| Middleware | Fungsi |
|------------|--------|
| `admin-access` | Memastikan user terautentikasi & berperan admin/super_admin |
| `super-admin` | Membatasi endpoint pengelolaan pengguna ke super admin |
| `EnsureAdminSessionFresh` | Menegakkan absolute session lifetime admin |
| `EnsureTwoFactorVerified` | Memastikan sesi sudah lolos 2FA bila aktif |
| `AddSecurityHeaders` | Menambahkan header keamanan ke seluruh respons |

### 5.5 Scheduled Jobs (Console Commands)

| Command | Fungsi |
|---------|--------|
| `ExpirePendingBookings` | Menandai Expired booking Pending yang jadwalnya sudah terlewat |
| `SyncIndonesianHolidays` | Sinkronisasi tanggal merah nasional dari provider |
| `PruneAuditLogs` | Memangkas audit log lebih tua dari retensi (default 180 hari) |
| `CleanupLunchBreakSlots` | Membersihkan slot jam istirahat |
| `ResetUserTwoFactor` | Mereset 2FA pengguna (operasional/recovery) |

---

## 6. Database Schema

### 6.1 `users`
| Kolom | Tipe | Catatan |
|-------|------|---------|
| id | bigint PK | |
| name | string | |
| email | string unique | |
| role | string (index) | `admin` \| `super_admin` (default admin) |
| phone | string nullable | |
| email_verified_at | timestamp nullable | null = akun nonaktif |
| password | string (hashed) | |
| two_factor_secret | text nullable | |
| two_factor_recovery_codes | text nullable | |
| two_factor_confirmed_at | timestamp nullable | |
| last_login_at | timestamp nullable | |
| remember_token | string | |
| timestamps | | |

### 6.2 `bookings`
| Kolom | Tipe | Catatan |
|-------|------|---------|
| id | bigint PK | |
| code | string unique | ISTURA-YYYY-NNNN |
| contact_name | string | |
| nik_encrypted | text | Crypt-encrypted NIK |
| nik_masked | string(32) | tampilan |
| nik_hash | string (index) | dedup identitas |
| whatsapp | string(32) | |
| whatsapp_normalized | string (index) | dedup identitas |
| institution | string | |
| group_size | smallint | jumlah rombongan |
| date | date | tanggal kunjungan |
| date_label | string | "Jumat, 29 Mei 2026" |
| time | string(5) | "09.00" |
| status | enum | Pending, Accepted, Rejected, Reschedule, Completed, Expired |
| document_path | string nullable | path surat privat |
| document_original_name | string | nama asli surat |
| feedback_token | string(64) unique | token feedback |
| submitted_at | timestamp | |
| completed_at | timestamp nullable | |
| feedback_expires_at | timestamp nullable | batas periode feedback (`completed_at + 14 hari`) |
| rejected_at | timestamp nullable | |
| expired_at | timestamp nullable | |
| note | text nullable | catatan admin |
| proposed_date / proposed_date_label / proposed_time | nullable | usulan reschedule |
| proposed_segments | json nullable | usulan pembagian kloter |
| proposed_at | timestamp nullable | |
| reschedule_previous_status | string nullable | status sebelum reschedule |
| active_slot_key | (lihat booking_slots) | kunci anti-overbook |
| timestamps | | |

Index: `status`, `(date,time)`, `(date,status)`.

### 6.3 `booking_slots`
| Kolom | Tipe | Catatan |
|-------|------|---------|
| id | bigint PK | |
| booking_id | FK → bookings (cascade) | |
| slot_order | smallint | urutan kloter |
| date | date | |
| date_label | string | |
| time | string(5) | |
| group_size | smallint | peserta di slot ini (≤80) |
| kind | string | normal \| proposed (reschedule) |
| active_slot_key | string(16) unique nullable | `date|time`, unik = anti-overbook |
| timestamps | | |

Unique: `(booking_id, slot_order)`, `active_slot_key`. Index: `(date,time)`.

### 6.4 `schedule_overrides`
| Kolom | Tipe | Catatan |
|-------|------|---------|
| id | bigint PK | |
| date | date | |
| time | string(5) | |
| status | enum | Available, Held, Booked, Closed, Reschedule Hold |
| custom | bool | slot di luar default |
| note | string nullable | |
| timestamps | | |

Unique: `(date, time)`. Index: `date`. Hanya slot termodifikasi yang disimpan; default
dihitung runtime.

### 6.5 `feedbacks`
| Kolom | Tipe | Catatan |
|-------|------|---------|
| id | bigint PK | |
| booking_id | FK → bookings nullable (index) | |
| code | string (index, non-unique) | denormalisasi untuk export |
| rating / booking_ease / service / recommend | tinyint | skala 1–5 |
| guide_quality / facility_comfort | tinyint nullable | skala 1–5; null untuk data lama |
| visited_before | bool nullable | pernah berkunjung ke Gedung Agung |
| discovery_source | string(40) nullable | kode sumber informasi tetap |
| discovery_source_other | string(120) nullable | detail ketika sumber `other` |
| highlights | json | aspek positif |
| improvements | json | area perbaikan |
| comment | text nullable | |
| allow_publish | bool | izin publikasi |
| submitted_at | timestamp nullable | |
| timestamps | | |

### 6.6 `national_holidays`
| Kolom | Tipe | Catatan |
|-------|------|---------|
| id | bigint PK | |
| date | date unique | |
| year | smallint (index) | |
| name | string | |
| type | string(32) | libur nasional / cuti bersama |
| tentative | bool | |
| source / source_url | string | provider |
| provider_updated_at / synced_at | timestamp nullable | |
| checksum | string(64) | deteksi perubahan |
| timestamps | | |

### 6.7 `faqs`
| Kolom | Tipe | Catatan |
|-------|------|---------|
| id | bigint PK | |
| slug | string unique | |
| question | string | |
| answer | text | |
| category | string nullable | |
| sort_order | int | |
| (link fields) | | label/href tautan opsional |
| timestamps | | |

### 6.8 `wa_templates`
| Kolom | Tipe | Catatan |
|-------|------|---------|
| id | bigint PK | |
| status_key | enum unique | Pending, Accepted, Rejected, Reschedule, Completed, Expired |
| label | string | |
| description | string | |
| template | text | placeholder `{nama}`, `{instansi}`, `{tanggal}`, `{jam}`, `{kode}`, `{link}`, dll |
| updated_by | FK → users nullable | |
| timestamps | | |

### 6.9 `footer_contacts`
| Kolom | Tipe | Catatan |
|-------|------|---------|
| id | bigint PK | |
| slug | string unique | |
| label / value | string | |
| icon | enum | instagram, youtube, whatsapp, email, phone |
| href | string nullable | |
| sort_order | int | |
| timestamps | | |

### 6.10 `site_settings`
| Kolom | Tipe | Catatan |
|-------|------|---------|
| id | bigint PK | |
| key | string unique | "hero", "letter", "site_content" |
| value | json | |
| timestamps | | |

### 6.11 `audit_logs`
| Kolom | Tipe | Catatan |
|-------|------|---------|
| id | bigint PK | |
| actor_id | FK → users nullable | null = sistem/publik |
| actor_name | string nullable | |
| action | string | deskripsi aksi |
| target_type / target_id | string nullable | objek terkait |
| payload | json nullable | detail + konteks request |
| created_at | timestamp | |

### 6.12 `trusted_devices`
| Kolom | Tipe | Catatan |
|-------|------|---------|
| id | bigint PK | |
| user_id | FK → users (cascade) | |
| device_hash | string(64) (index) | |
| device_name | string nullable | |
| trusted_until | timestamp | masa berlaku trust 2FA |
| timestamps | | |

Unique: `(user_id, device_hash)`.

### 6.13 `booking_sequences`
| Kolom | Tipe | Catatan |
|-------|------|---------|
| id | bigint PK | |
| year | smallint unique | |
| next_sequence | int | counter kode booking per tahun (locked) |
| timestamps | | |

### 6.14 Tabel Sistem
`sessions`, `password_reset_tokens`, `personal_access_tokens` (Sanctum), `cache`,
`jobs`/`job_batches`/`failed_jobs` (queue database).

### 6.15 Relasi Utama
```
users 1───* audit_logs (actor)
users 1───* trusted_devices
users 1───* wa_templates (updated_by)
bookings 1───* booking_slots
bookings 1───* feedbacks
bookings *───* schedule (via date/time, dihitung ScheduleService)
```

---

## 7. Design & Technical Constraints

### 7.1 Constraints Fungsional
- **Rentang booking:** H-2 sampai +2 bulan; di luar itu tidak dapat dipesan.
- **Kapasitas slot:** 80 orang per kloter; rombongan besar dipecah ke slot berurutan
  (maks total 480/hari).
- **Jam layanan:** Senin–Kamis (08.00–11.00 & 13.00–14.00 WIB); 12.00 istirahat;
  Jumat–Minggu & libur nasional tertutup.
- **Anti-overbooking:** dijamin di level DB via unique `active_slot_key` + transaksi
  `lockForUpdate`.
- **Batas identitas:** satu NIK/WhatsApp dibatasi booking aktif bersamaan (konfigurasi env).
- **Kedaluwarsa otomatis:** Pending berubah ke Expired hanya setelah jam kunjungan terlewat via job.

### 7.2 Constraints Keamanan & Privasi
- NIK tidak pernah disimpan/terkirim sebagai plaintext ke klien (hanya masked/hash).
- Surat permohonan privat; tidak ada URL publik; hanya admin via endpoint terautentikasi.
- Rate limit pada seluruh endpoint publik & auth (booking, feedback, schedule, login, 2FA).
- Progressive delay login (eksponensial, cap 5 menit) setelah 3x gagal.
- Absolute session lifetime admin (default 720 menit) + 2FA opsional TOTP.
- Security headers + CORS dibatasi origin terdaftar (`SANCTUM_STATEFUL_DOMAINS`,
  `CORS_ALLOWED_ORIGINS`).
- Upload divalidasi MIME + ukuran ≤ 5 MB.
- Link dokumentasi yang disisipkan ke WhatsApp wajib HTTPS dan host-nya harus ada di
  `DOCUMENTATION_LINK_HOSTS` (default Google Drive/Photos).
- FormRequest/policy mutasi admin menegakkan role operator selain middleware route, sehingga
  viewer tetap read-only bila routing berubah di masa depan.

### 7.3 Constraints Teknis
- **Single origin:** frontend & backend satu domain; SPA router berbasis state (bukan path
  server). Semua rute non-API jatuh ke shell React.
- **Timezone tetap Asia/Jakarta**, locale `id`.
- **Realtime opsional:** `VITE_REVERB_ENABLED=false` mematikan WebSocket; aplikasi tetap
  jalan dengan refetch manual (degradasi anggun).
- **Ekspor di sisi browser:** PDF/XLSX/ZIP digenerasi di klien (pdfmake, exceljs, jszip),
  bukan di server.
- **Cache publik bervers:** versi cache di-bump saat data berubah; perubahan admin langsung
  tampil.
- **Dependensi runtime dev:** butuh 3 proses paralel (Laravel serve, Vite, Reverb).
- **Database:** MySQL; pengembangan lokal kadang di port 3307 (sesuaikan `.env`).

### 7.4 Constraints Desain UI/UX
- Identitas visual istana: nuansa gold/elegan, pemandu virtual **MIKY** memandu wizard.
- Wizard booking bertahap dengan helper kontekstual & autosave draft.
- Status slot dibedakan warna (gold = tersedia, abu-abu = tidak tersedia) dengan alasan
  penutupan eksplisit (libur nasional, akhir pekan, ditutup admin).
- Modal/overlay wajib aksesibel: `role="dialog"`, `aria-modal`, focus trap, ESC menutup,
  scroll body terkunci.
- Seluruh teks Bahasa Indonesia; format tanggal panjang lokal ("Jumat, 29 Mei 2026").

### 7.5 Asumsi & Ketergantungan
- Provider tanggal merah nasional eksternal tersedia untuk auto-sync jadwal libur.
- Konfirmasi ke pengunjung dilakukan **manual via WhatsApp** (admin menyalin pesan
  tergenerasi); tidak ada integrasi WhatsApp API otomatis.
- Akun admin awal dibuat via seeder (`SEED_ADMIN_PASSWORD`), lalu password dirotasi.

### 7.6 Out of Scope (Versi Ini)
- Pengiriman pesan WhatsApp otomatis / integrasi WA API.
- Pembayaran (kunjungan gratis).
- Check-in / scan di lokasi.
- Verifikasi identitas/OTP pengunjung.

---

## Lampiran A — Ringkasan Endpoint untuk Skenario Test

| Aksi Pengguna | Endpoint | Metode | Auth |
|---------------|----------|--------|------|
| Muat data awal publik | `/api/public/bootstrap` | GET | Publik |
| Lihat jadwal | `/api/public/schedule` | GET | Publik |
| Precheck booking | `/api/public/bookings/precheck` | POST | Publik |
| Submit booking | `/api/public/bookings` | POST | Publik |
| Lihat feedback | `/api/public/feedback/{code}` | GET | Token |
| Submit feedback | `/api/public/feedback/{code}` | POST | Token |
| Login admin | `/api/auth/login` | POST | Publik |
| Verifikasi 2FA | `/api/auth/two-factor/verify` | POST | Sesi |
| Dashboard admin | `/api/admin/dashboard` | GET | Admin |
| Daftar booking | `/api/admin/bookings` | GET | Admin |
| Accept booking | `/api/admin/bookings/{code}/accept` | POST | Admin |
| Reject booking | `/api/admin/bookings/{code}/reject` | POST | Admin |
| Reschedule booking | `/api/admin/bookings/{code}/reschedule` | POST | Admin |
| Complete booking | `/api/admin/bookings/{code}/complete` | POST | Admin |
| Hapus booking permanen | `/api/admin/bookings/{code}` | DELETE | Admin |
| Tutup rentang jadwal | `/api/admin/schedule/range` | POST | Admin |
| Lihat event Istura Open aktif | `/api/public/open-event` | GET | Publik |
| Daftar Istura Open | `/api/public/open-registrations` | POST | Publik |
| Kelola event Istura Open | `/api/admin/open-events` | GET/POST/PUT/DELETE | Admin |
| Arsip/pulihkan event Istura Open | `/api/admin/open-events/{event}/archive`, `/api/admin/open-events/{event}/unarchive` | POST | Admin |
| Kelola pengguna | `/api/admin/users` | GET/POST/PUT/DELETE | Super Admin |

## Lampiran B — Akun & Peran

| Peran | Akses |
|-------|-------|
| Pengunjung (publik) | Landing page, jadwal, booking, feedback |
| Admin | Semua fitur operasional & CMS, kecuali kelola pengguna |
| Super Admin | Seluruh akses Admin + kelola akun admin |
