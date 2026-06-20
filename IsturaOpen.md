# PRD — Istura Open

Status: Final (siap implementasi)
Versi: 1.0
Pemilik produk: Admin Istura (Mbak Fit)
Penyusun: Hasbi
Terakhir diperbarui: Juni 2026

> Dokumen ini menggantikan draf diskusi sebelumnya (dua usulan mentah Opus/GPT).
> Semua keputusan di bawah sudah dikonfirmasi ke admin kecuali yang ditandai
> **TERBUKA** pada bagian "Keputusan yang Masih Terbuka".

---

## 1. Ringkasan

**Istura Open** adalah mode pendaftaran kunjungan **perorangan dan khusus** untuk
periode/event tertentu (mis. pekan kemerdekaan 17 Agustus), terpisah dari booking
rombongan reguler. Pendaftaran bersifat **siapa cepat dia dapat (first-come-first-served),
tanpa surat, tanpa persetujuan admin**. Kuota dihitung **per hari berbasis jumlah kepala
(headcount)**. Setelah berhasil mendaftar, pendaftar **langsung menerima link grup
WhatsApp** untuk hari yang dipilih.

Modul dibuat **reusable**: satu konsep tetap, tetapi admin dapat membuat dan
mengaktifkan event Istura Open baru kapan pun dari panel admin tanpa perubahan kode.

---

## 2. Latar Belakang & Masalah

Sistem booking reguler ("Istura biasa") dibangun dengan asumsi yang **bertabrakan**
dengan kebutuhan Istura Open. Terbukti di kode:

- **Model kapasitas berbeda.** Booking reguler menghitung kapasitas **biner per slot
  jam** (`BookingService::SLOT_CAPACITY = 80`; grup besar dipecah lewat
  `splitGroupSizes()`). Istura Open butuh **kuota per HARI berbasis headcount**.
- **`ScheduleService` membaca tabel `bookings`** (`date`+`time`) di `buildHorizon()`,
  `activeBookingCount()`, dan `slotStatusFor()`. Bila pendaftaran open ikut masuk ke
  tabel `bookings`, perhitungan jadwal rombongan akan terkontaminasi.
- **Asumsi data per-booking berbeda.** Booking reguler wajib `document`, `institution`,
  `date`, `time` (lihat `StoreBookingRequest`). Istura Open: tanpa surat, tanpa jam, add-on
  hanya nama.

**Keputusan arsitektur:** buat **modul terpisah** yang berdampingan, mereuse infrastruktur
matang (enkripsi NIK, audit log, rate limit, generator kode, export) **tanpa menyentuh**
flow rombongan, `ScheduleService`, atau `BookingService`. Ini menekan risiko regresi pada
bagian paling rapuh menjadi mendekati nol.

---

## 3. Tujuan & Metrik Keberhasilan

**Tujuan**
- Memungkinkan pendaftaran perorangan massal selama event, dengan kuota harian aman dari
  kelebihan (no overbooking).
- Memberi pendaftar akses instan ke grup WhatsApp hari yang dipilih.
- Memberi admin alat membuat event, mengatur kuota & link grup per hari, memantau
  keterisian, dan mengekspor daftar peserta per hari.
- Modul dapat dipakai ulang untuk event berikutnya tanpa rilis kode baru.

**Metrik**
- 0 kejadian kuota harian terlampaui (headcount > kuota) di bawah beban bersamaan.
- 100% pendaftaran sukses menerima link grup WA yang benar untuk harinya.
- Admin dapat menyiapkan event baru end-to-end hanya dari panel.

---

## 4. Keputusan yang Sudah Dikunci

| #   | Keputusan               | Nilai                                                                                                                                                 |
| -----| -------------------------| -------------------------------------------------------------------------------------------------------------------------------------------------------|
| 1   | Penentuan hari          | **Peserta memilih sendiri** (`self_select`)                                                                                                           |
| 2   | Periode event Agustus   | 3 hari: **14, 15, 16 Agustus**                                                                                                                        |
| 3   | Kuota per hari          | **100 orang (headcount)**, dapat di-override per hari                                                                                                 |
| 4   | Add-on memenuhi kuota   | **Ya** (1 pendaftar + add-on = headcount)                                                                                                             |
| 5   | Add-on                  | **Nama saja**, maksimal **4**, tanpa NIK                                                                                                              |
| 6   | Identitas (anti-borong) | **1 NIK + 1 WhatsApp** = masing-masing 1 pendaftaran aktif per event                                                                                  |
| 7   | Surat permohonan        | **Tidak ada**                                                                                                                                         |
| 8   | Persetujuan admin       | **Tidak ada** — first-come otomatis                                                                                                                   |
| 9   | Output sukses           | **Link grup WhatsApp hari terpilih** (bukan nomor pendaftaran)                                                                                        |
| 10  | Grup WhatsApp           | Admin membuat 1 grup per hari, menempel link per hari sebelum membuka                                                                                 |
| 11  | Verifikasi di lokasi    | **Hanya cek kelengkapan/kuota**, tanpa verifikasi identitas per orang                                                                                 |
| 12  | Pembatalan              | Admin penuh **+ self-cancel via lookup NIK** (mengembalikan kuota)                                                                                    |
| 13  | Setelan grup WA         | Join instan (approve OFF); approve/rotasi link sebagai tuas bila bocor                                                                                |
| 14  | Modul                   | **Terisolasi & reusable**, satu event aktif pada satu waktu                                                                                           |
| 15  | Mode assignment         | `assignment_mode` disimpan sebagai kolom; **hanya `self_select` diimplementasi v1**                                                                   |
| 16  | Mode pembukaan          | **Serentak** (`release_mode = simultaneous`) — 3 hari dibuka bersamaan, bebas pilih selagi kuota ada                                                  |
| 17  | Anti-borong             | **1 NIK + 1 WhatsApp**, masing-masing **1 pendaftaran aktif** per event; **IP hanya untuk rate-limit**, bukan kunci keunikan; **email tidak dipakai** |

---

## 5. Keputusan yang Sebelumnya Terbuka (kini terkunci)

- **TERKUNCI — `release_mode` = `simultaneous` (serentak).** Konfirmasi admin (Mbak Fit):
  ketiga hari (14/15/16) dibuka **bersamaan** sejak awal; peserta **bebas memilih hari mana
  pun** yang masih ada kuota. Mode `sequential` (bertahap) tetap didukung skema (`opens_at`
  per hari) tetapi tidak dipakai untuk event ini.
- **Dampak ke arsitektur: nol.** Hanya nilai konfigurasi (`release_mode` + `opens_at` semua
  hari diisi saat event dibuka).

Tidak ada keputusan yang masih terbuka.

---

## 6. Ruang Lingkup

**Termasuk**
- 3 tabel baru, model, service, controller publik & admin, FormRequest, routes.
- Form pendaftaran publik ringkas + popup/banner event.
- Panel admin: konfigurasi event, kartu per hari (kuota + link WA + counter), daftar
  pendaftar (detail, batal, export).
- Self-cancel & pemulihan link via lookup NIK + WhatsApp, termasuk setelah window
  pendaftaran ditutup selama event masih aktif dan belum lewat.

**Tidak termasuk**
- Perubahan apa pun pada `bookings`, `BookingService`, `ScheduleService`,
  `schedule_overrides`, `booking_slots`, atau flow rombongan.
- Modul check-in / scan di lokasi (admin hanya cek kelengkapan).
- Pengiriman pesan WhatsApp otomatis / WA API.
- Mode `pool` (admin distribusi manual) — kolom disiapkan, implementasi ditunda.
- Form builder / field dinamis. Bentuk pendaftaran dikunci.
- OTP/verifikasi nomor. Pengaman cukup NIK-dedup + rate limit.

**Menutup jadwal rombongan pekan event:** gunakan fitur yang **sudah ada**
(`POST admin/schedule/range` status `Closed`); 17 Agustus juga sudah auto-closed sebagai
libur nasional. Tidak ada logika baru. Detail koeksistensi di §9.6.

**Default OFF & kill-switch (penting).** Saat fitur ini di-deploy, **tidak ada perubahan di
sisi publik** sampai admin sengaja menyalakannya. Jaminan berlapis:
- Tabel `open_events` kosong → `/public/bootstrap` tidak mengirim event aktif → tanpa popup,
  banner, form, maupun menu Istura Open. Publik hanya melihat booking reguler.
- `is_active` **default `false`**; draft event tidak memunculkan apa pun ke publik.
- Aktivasi adalah 3 langkah sengaja oleh admin: **buat event → isi kuota & link grup WA tiap
  hari → Aktifkan** (guard menolak bila ada hari Buka tanpa link WA).
- Set `is_active = false` kapan pun = **kill-switch**: permukaan publik Istura Open langsung
  hilang, booking reguler tetap jalan.
- Event yang **diarsipkan** (`archived_at` terisi) atau **sudah lewat** (`end_date` sebelum hari
  ini) tidak dikembalikan oleh endpoint publik dan tidak menerima pendaftaran baru. Arsip adalah
  jalur utama untuk event yang sudah punya pendaftar; hapus permanen hanya untuk draft kosong.

---

## 7. Model Data

Tidak ada perubahan skema `bookings`. Empat tabel khusus modul:

### 7.1 `open_events`
| Kolom | Tipe | Catatan |
|-------|------|---------|
| id | bigint PK | |
| name | string | mis. "Istura Open Kemerdekaan 2026" |
| slug | string unik | dipakai untuk kunci popup "seen" di klien |
| start_date | date | |
| end_date | date | |
| per_day_quota | int | default 100 |
| max_addons | int | default 4 |
| assignment_mode | enum | `self_select` (default) \| `pool` (kolom saja v1) |
| release_mode | enum | `simultaneous` (default) \| `sequential` |
| registration_opens_at | datetime nullable | |
| registration_closes_at | datetime nullable | |
| agreement_text | text nullable | teks persetujuan yang ditampilkan |
| poster_path | string nullable | poster/flyer opsional, disimpan WebP di disk public |
| promo_subtitle | string nullable | subjudul popup per-event |
| banner_text | string nullable | teks banner berjalan per-event |
| whatsapp_template | text nullable | opsional, untuk masa depan |
| is_active | bool | **default `false`**; **hanya satu boleh true** (lihat §6 Default OFF) |
| archived_at | datetime nullable | penanda arsip; event arsip tidak tampil di publik |
| timestamps | | |

### 7.2 `open_event_days`
| Kolom | Tipe | Catatan |
|-------|------|---------|
| id | bigint PK | |
| open_event_id | FK | |
| date | date | satu baris per tanggal event |
| quota_override | int nullable | null = ikut `per_day_quota` |
| whatsapp_group_url | string nullable | link grup hari itu |
| opens_at | datetime nullable | mendukung mode bertahap |
| is_open | bool | hari dibuka untuk pendaftaran |
| timestamps | | |

Unik: (`open_event_id`, `date`).

### 7.3 `open_registrations`
| Kolom | Tipe | Catatan |
|-------|------|---------|
| id | bigint PK | |
| code | string unik | internal, mis. `ISTURA-OPEN-2026-0001` |
| open_event_id | FK | |
| assigned_event_day_id | FK nullable | hari terpilih (`self_select` mengisi saat submit) |
| contact_name | string | |
| nik_encrypted | text | reuse pola `Booking` (Crypt) |
| nik_masked | string | tampilan admin |
| nik_hash | string (index) | reuse `Booking::identityHash()` untuk dedup |
| whatsapp | string | |
| whatsapp_normalized | string (index) | reuse `Booking::normalizeWhatsapp()` |
| members | json | array nama add-on (maks `max_addons`), tanpa NIK |
| headcount | int | 1 + jumlah add-on |
| status | enum | `Registered` \| `Confirmed` \| `Cancelled` \| `Waitlisted` |
| registered_at | datetime | |
| cancelled_at | datetime nullable | |
| timestamps | | |

**Status aktif (memenuhi kuota):** `Registered`, `Confirmed` (analog
`Booking::ACTIVE_STATUSES`). `Cancelled` membebaskan kuota & slot NIK. `Waitlisted`
opsional (lihat §8.3).

> **Catatan add-on JSON vs tabel anak:** add-on hanya nama tanpa atribut lain dan tidak
> pernah di-query mandiri, sehingga JSON cukup. Bila kelak butuh pencarian per nama add-on
> atau export per-orang, pisahkan jadi tabel `open_registration_members`.

---

## 8. Mekanika Kuota & Konkurensi

### 8.1 Penguncian atomic
Mengikuti pola `booking_sequences` (kunci satu baris counter), **bukan** slot locks:

```
DB::transaction:
  day = OpenEventDay::lockForUpdate()->findOrFail(dayId)
  assertDayOpenAndWithinWindow(day, event)
  used = OpenRegistration::where(open_event_id, event.id)
           ->where(assigned_event_day_id, day.id)
           ->whereIn(status, [Registered, Confirmed])
           ->sum(headcount)
  quota = day.quota_override ?? event.per_day_quota
  if (used + newHeadcount > quota) -> tolak (lihat 8.3)
  assertNikNotAlreadyActive(event, nikHash)   // 1 NIK = 1 aktif
  simpan registrasi (status Registered, code internal via generator)
  return day.whatsapp_group_url
```

### 8.2 Anti-abuse
Bedakan **kunci keunikan** (cegah borong) dari **throttle** (cegah flood):

- **NIK — 1 pendaftaran aktif/event** (cek `nik_hash`), divalidasi di precheck & submit
  (satu sumber aturan, seperti `identityActiveBookingExceeded()` di booking).
- **WhatsApp — 1 pendaftaran aktif/event** (cek `whatsapp_normalized`). Tidak menyakiti
  keluarga karena rombongan ditampung add-on (≤5 kepala/pendaftaran). Konsisten dengan
  booking reguler yang membatasi NIK & WhatsApp.
- **IP — hanya rate-limit, BUKAN kunci keunikan.** IP berbagi (kantor, WiFi publik, CGNAT
  seluler) → "1/IP" akan salah blokir pengguna sah. Reuse/clone `public-bookings` sebagai
  limiter `public-open`.
- **Email — tidak dipakai.** Tidak ada di model data; email tak terverifikasi = nol proteksi.
- **Limit configurable per event.** Admin bisa melonggarkan bila perlu.
- **Catatan jujur:** tanpa verifikasi (OTP/cek identitas di lokasi), semua batasan ini lapis
  lunak — menahan abuse malas, bukan antipeluru. Teeth nyata butuh OTP WhatsApp (ditunda).
  Diterima sesuai model longgar yang dipilih admin; payoff abuse kecil (hanya masuk grup WA).

### 8.3 Saat kuota hari penuh
- Default v1: tolak dengan pesan "Hari ini sudah penuh, pilih hari lain" + kembalikan sisa
  kuota terbaru tiap hari agar UI menyegarkan pilihan.
- `Waitlisted` disiapkan di enum tetapi **tidak diaktifkan v1**.

---

## 9. Alur Publik

### 9.1 Form pendaftaran
Field: `contact_name`, `nik` (16 digit), `whatsapp`, `members[]` (0–`max_addons` nama),
`assigned_day` (mode self_select), `agreement` (accepted). **Tanpa** `document`, **tanpa**
jam. Reuse regex existing: NIK `/^\d{16}$/`, WhatsApp `/^(08|628)\d{8,13}$/`.

### 9.2 Langkah
1. Pengunjung melihat hari tersedia + **sisa kuota per hari** (endpoint publik **tidak**
   mengirim link WA).
2. Pilih hari → isi form → submit.
3. Sukses (kuota terkunci) → tampilkan **tombol "Gabung Grup WhatsApp"** (link hari itu) +
   kode internal kecil sebagai cadangan.
4. Kuota penuh saat submit → pesan + segarkan sisa kuota.
5. **NIK sudah terdaftar → tampilkan ulang link grup yang sudah diambil** (fitur pemulihan
   link sekaligus penegak 1-NIK).

### 9.3 Aturan keamanan link (KRITIS)
- Link grup **hanya** dikembalikan pada response sukses, **setelah** commit kuota.
- Link **tidak pernah** ada di HTML/JS form atau endpoint jadwal publik sebelum submit
  (mencegah orang mengambil link tanpa mendaftar).
- Hari **tidak boleh** `is_open` jika `whatsapp_group_url` kosong (cek saat aktivasi event)
  — mencegah pendaftaran tanpa link.

### 9.4 Self-cancel & pemulihan link
Layar "Cek pendaftaran" (yang sama untuk pemulihan link) meminta **NIK dan WhatsApp yang
cocok** sebelum menampilkan detail/link grup. Tombol **"Batalkan pendaftaran"** memakai
konfirmasi; pembatalan mengubah status → `Cancelled`, mengembalikan kuota & membebaskan
NIK/WhatsApp. Lookup/cancel tetap tersedia setelah `registration_closes_at` lewat selama event
masih aktif, belum arsip, dan belum lewat; form pendaftaran baru tetap ditutup.

### 9.5 Interaktivitas & Realtime

Flow Istura Open dibuat **interaktif** seperti `BookingWizard`, tetapi sebagai **komponen
baru `IsturaOpenWizard`** — *tidak* memodifikasi `BookingWizard` yang terkopel ke
surat/jam/segment (jaga batas scope).

**Wizard ringkas (langkah):**
```
0. Pilih hari   → kartu hari dengan sisa kuota LIVE (14 Agt 62/100 ...)
1. Data diri    → nama, NIK, WhatsApp  (precheck NIK saat lanjut)
2. Add-on       → daftar dinamis 0–max_addons nama
3. Review       → ringkasan + persetujuan
4. Sukses       → tombol "Gabung Grup WhatsApp" (link hari terpilih)
```
Lebih ringan dari wizard reguler (tanpa upload surat & tanpa pemilih jam).

**Reuse blok UX matang:** `FormField`, panduan MIKY, autosave draft
(`writeBookingDraft`/`readBookingDraft`), transisi antar-step, pola precheck.

**Kuota live (jantung interaktivitas):** meniru pola `.schedule.updated` → `refreshSchedule`
di `useIsturaData.ts`.
- Tambah event broadcast publik **`OpenQuotaUpdated`** (`app/Events`), dipicu saat registrasi
  dibuat / dibatalkan / dipindah.
- Tambah channel publik (mis. `PUBLIC_OPEN_CHANNEL`) di `realtime/echo.ts`; frontend
  `listen(".open.quota-updated")` lalu refetch sisa kuota per hari.
- Counter `x/100` turun real-time di layar semua pengunjung; kartu hari yang penuh otomatis
  menjadi non-aktif.

**Penanganan race:** tampilan kuota optimistic, keputusan otentik tetap di submit
(`lockForUpdate` baris hari, §8.1). Bila penuh saat submit → pesan "penuh, pilih hari lain"
+ kuota di-refresh live. Interaktif tetapi tidak bisa overbooking.

> Gerbang realtime mengikuti `VITE_REVERB_ENABLED`; bila realtime nonaktif, kuota tetap
> akurat lewat refetch saat membuka langkah pilih hari dan saat submit (degradasi anggun,
> sama seperti jadwal reguler).

### 9.6 Koeksistensi dengan Booking Reguler

**Istura Open TIDAK menutup pola booking reguler secara global.** Keduanya berdampingan sebagai
entry point berbeda.

- Booking reguler tetap melayani rentang H-2 s/d +2 bulan untuk tanggal di luar hari Istura Open.
- Tabrakan tanggal event dicegah oleh `ScheduleService`: hari event yang **aktif, belum arsip,
  dan `OpenEventDay.is_open = true`** ditampilkan `Closed` dengan alasan `Tutup — Istura Open`
  di kalender/wizard rombongan. Hari event yang admin set "Tutup" tetap bisa dipakai booking
  rombongan.
- Saat admin membuka hari yang sudah memiliki booking rombongan aktif, backend mengembalikan
  konflik dan UI meminta admin memilih "Batal" atau "Tetap buka"; sistem tidak memindahkan atau
  membatalkan booking rombongan otomatis.

Pemicu Istura Open di publik: **popup + banner** (§11) dan, opsional, item di `Navigation`
saat event aktif — mengarah ke `IsturaOpenWizard`, terpisah dari tombol "Daftar Rombongan".

---

## 10. Alur & Tata Letak Admin

### 10.1 Menu
Tambah entri di `ADMIN_MENU` (constants.ts) pada grup **Operasional**, dekat "Booking" &
"Jadwal Kunjungan": `{ key: "istura-open", label: "Istura Open", icon: ..., status: "ready" }`.
Tambah `"istura-open"` ke tipe `AdminTab` dan routing screen di `AdminApp`.

### 10.2 Struktur layar
Satu screen penuh (pola `AdminScheduleManager`) dengan header event + 2 tab.

```
┌─ Istura Open ───────────────────────────────────────────────┐
│ Event: [ Kemerdekaan 2026 · Aktif ▾ ] [Edit event] [Aktifkan] [Arsipkan] [Hapus draft] │
│ 14–16 Agt · self-select · 100/hari · maks 4 add-on           │
├──────────────────────────────────────────────────────────────┤
│  [ Pengaturan & Hari ]   [ Pendaftar ]                        │
└──────────────────────────────────────────────────────────────┘
```

**Tab A — Pengaturan & Hari**

Form event (buat/edit): nama, **tanggal pilihan** (`dates[]`: satu hari, rentang, atau tanggal
tidak berurutan), kuota/hari, maks add-on, mode pilih hari
(self_select, terkunci v1), `release_mode` (serentak/bertahap), jendela daftar
(buka/tutup), teks persetujuan, poster/flyer opsional, copy promo, status aktif, dan lifecycle
draft/aktif/lewat/arsip. Event baru/tanggal baru tidak boleh berada di masa lampau; tanggal lampau
yang sudah menjadi bagian event berjalan boleh dipertahankan saat edit. Aksi status berada di
toolbar atas; tombol **Edit event** juga berada di toolbar agar admin bisa menambah hari atau
memindahkan jadwal event tanpa membuat event baru.

Kartu per hari (jantung operasional, mirip grid slot di ScheduleManager):
```
┌── Senin, 14 Agustus ──────────────┐ ┌── Selasa, 15 Agustus ─────────────┐
│ Kuota: [ 100 ]  Terisi: 62/100 ▓▓░│ │ Kuota: [ 100 ]  Terisi: 0/100 ░░░ │
│ Link grup WA: [ https://chat... ] │ │ Link grup WA: [   belum diisi ⚠  ] │
│ Status: [ ●Buka / Tutup ]         │ │ Status: [  Tutup ]                 │
│ [ Lihat pendaftar ] [ Export hari]│ │ [ Lihat pendaftar ] [ Export hari ]│
└───────────────────────────────────┘ └───────────────────────────────────┘
```
- **Guard aktivasi:** "Aktifkan" ditolak bila ada hari Buka dengan link WA kosong. Bila hari
  yang akan aktif masih memiliki booking rombongan aktif, admin mendapat daftar konflik dan
  harus memilih "Tetap aktifkan" secara eksplisit sebelum event aktif.
- Counter `Terisi x/100` tersinkron realtime; saat Reverb gagal tersedia polling fallback.

**Tab B — Pendaftar** (pola `BookingScreen`: tabel + filter + export)
```
Filter: [ Hari ▾ semua ] [ Status ▾ ] [ cari nama/WA ]   [ Export ▾ ]
┌────┬──────────┬───────────┬────────┬─────────┬──────────┬─────────┐
│ Hr │ Nama     │ WhatsApp  │ Kepala │ Add-on  │ Status   │ Aksi    │
├────┼──────────┼───────────┼────────┼─────────┼──────────┼─────────┤
│ 14 │ Budi S.  │ 0812xxxx  │ 4      │ +3 nama │ Terdaftar│ ⋮       │
└────┴──────────┴───────────┴────────┴─────────┴──────────┴─────────┘
```
Aksi per baris: **detail** (nama add-on, kode, waktu daftar) dan **batalkan** (kembalikan
kuota). Pendaftar tidak dipindah hari dari admin karena pendaftar langsung menerima link
grup WhatsApp hari pilihannya saat berhasil daftar; salah hari diselesaikan dengan pembatalan
dan pendaftaran ulang/lookup sesuai operasional.

### 10.3 Header event (multi-event)
Dropdown memilih event, tombol "Buat Event", badge status. Mengaktifkan satu event otomatis
menonaktifkan yang lain (dengan konfirmasi), menjaga aturan "satu event aktif".

---

## 11. Popup & Banner Publik

### 11.1 Popup (saat event aktif)
Pola overlay (ikuti `admin-idle-overlay`). Modal cocok karena ini ajakan fokus.
```
┌───────────────────────────────────────────┐
│  [x]   🎉  ISTURA OPEN KEMERDEKAAN          │
│      Kunjungan perorangan 14–16 Agustus     │
│  Gratis, tanpa surat. Pilih harimu,          │
│  kuota 100/hari. Siapa cepat dia dapat.      │
│   Sisa: 14 Agt 62 · 15 Agt 100 · 16 Agt 100 │
│     [ Daftar Sekarang ]   [ Nanti saja ]    │
└───────────────────────────────────────────┘
```
- Muncul saat ada event `is_active` **dan** pendaftaran terbuka **dan** masih ada kuota.
- **Sekali per pengunjung per event**: `localStorage["istura-open-seen:{slug}"]`.
- Data event menumpang di `/public/bootstrap`.
- **Wajib aksesibilitas:** `role="dialog"`, `aria-modal`, fokus terkunci, ESC menutup,
  klik scrim menutup, scroll body dikunci.

### 11.2 Banner persisten
Setelah popup ditutup, sisakan strip ramping di `HomeScreen` (di atas hero) selama event
aktif sebagai jalan masuk permanen. Popup = sekali; banner = selalu selama event.

---

## 12. Peta Reuse Infrastruktur

| Kebutuhan | Reuse dari |
|-----------|-----------|
| Enkripsi/hash NIK | `Booking::identityHash()`, accessor pola `nik_encrypted/masked/hash` (public static, **nol sentuhan** ke Booking) |
| Normalisasi WhatsApp | `Booking::normalizeWhatsapp()` |
| Kode unik | `BookingCodeGenerator` (atau turunan prefix `ISTURA-OPEN`) |
| Penguncian counter | pola `booking_sequences` + `lockForUpdate` |
| Audit | `AuditLogger::record()` |
| Rate limit | `public-bookings` (clone `public-open`) |
| Export Excel/ZIP | `exportBookings.ts` / `exportShared.ts` sebagai basis |
| Modal/overlay UI | pola `admin-idle-overlay`, `ScheduleRangeModal`, `ExportModals` |
| Menu admin | `ADMIN_MENU`, `AdminShell`, tipe `AdminTab` |
| Realtime kuota live | pola `realtime/echo.ts` + `.schedule.updated`→`refreshSchedule` di `useIsturaData.ts`; event baru `OpenQuotaUpdated` |
| Wizard interaktif | blok UX `BookingWizard` (FormField, MIKY, draft autosave, step) — disalin ke `IsturaOpenWizard`, bukan diubah |

> Opsi rapi (opsional): ekstrak trait `HasEncryptedIdentity` agar `Booking` & `OpenRegistration`
> berbagi accessor. Perilaku identik; ini satu-satunya sentuhan ke `Booking` dan boleh ditunda.

---

## 13. Endpoint (rencana)

**Publik** (`routes/api.php`, prefix `public`, throttle `public-open`)
- `GET  public/open-event` — event aktif + hari + sisa kuota (TANPA link WA).
- `POST public/open-registrations/precheck` — cek NIK & WhatsApp belum terdaftar + kuota tersedia.
- `POST public/open-registrations` — store; sukses mengembalikan link grup WA.
- `POST public/open-registrations/lookup` — input NIK + WhatsApp → tampilkan registrasi + link / opsi batal.
- `POST public/open-registrations/cancel` — self-cancel via NIK + WhatsApp.

**Realtime**
- Channel publik `PUBLIC_OPEN_CHANNEL`, event `.open.quota-updated` (`OpenQuotaUpdated`)
  → dipancarkan saat registrasi dibuat/dibatalkan; klien refetch sisa kuota.

**Admin** (prefix `admin`, middleware `admin-access`)
- `GET    admin/open-events`, `POST admin/open-events`, `PUT admin/open-events/{event}`
- `DELETE admin/open-events/{event}` — hanya event nonaktif tanpa riwayat pendaftar
- `POST   admin/open-events/{event}/activate`
- `POST   admin/open-events/{event}/archive` — nonaktifkan dan simpan sebagai arsip
- `POST   admin/open-events/{event}/unarchive` — pulihkan arsip menjadi draft nonaktif
- `PUT    admin/open-events/{event}/days/{day}` — kuota override, link WA, buka/tutup
- `GET    admin/open-events/{event}/registrations` — filter hari/status/cari, paginasi
- `POST   admin/open-registrations/{code}/cancel`
- `GET    admin/open-events/{event}/export` — per hari (nama, WA, headcount, add-on)

---

## 14. Risiko yang Diterima

- **Bocornya link grup WA.** Tanpa verifikasi identitas di lokasi, anggota grup ≈ daftar
  de facto. Diterima sesuai model longgar admin. Mitigasi operasional (tuas, bukan kode):
  nyalakan "setujui anggota baru" / rotasi link grup bila kebobolan.
- **Pendaftaran fiktif (NIK karangan).** NIK tak terverifikasi; dedup hanya cegah duplikat
  persis. Pengaman: rate limit + 1-NIK-aktif. OTP ditunda hingga ada bukti abuse.
- **No-show membakar kuota.** Dikurangi self-cancel + pembatalan admin; sisanya diterima.
- **Anggota grup ≠ 100.** Headcount termasuk add-on (yang tidak punya WA), jadi jumlah
  anggota grup < kuota. Perlu disamakan ekspektasinya dengan admin.

---

## 15. Rencana Verifikasi

Fungsional:
- Pendaftar yang membuat headcount melebihi kuota ditolak; pendaftar tepat di batas diterima.
- **Konkurensi:** dua submit bersamaan pada sisa kuota 1 → hanya satu lolos (uji transaksi +
  `lockForUpdate`).
- 1 NIK hanya 1 registrasi aktif; `Cancelled` membebaskan kuota & NIK.
- Add-on maks `max_addons`; headcount = 1 + add-on terhitung benar.
- NIK duplikat mengembalikan link existing, bukan menambah kuota.

Keamanan:
- Link WA **tidak** muncul di payload endpoint jadwal/HTML form sebelum submit sukses.
- Hari tanpa `whatsapp_group_url` tidak bisa dibuka/diaktifkan.

Regresi (kritis):
- `ScheduleService::buildHorizon()` dan flow rombongan **tidak berubah** dengan adanya data
  Istura Open (tabel terpisah; tidak ada query silang).
- Booking reguler tetap dapat diakses saat event aktif; hanya tanggal event yang `Closed`
  di jadwal reguler dan tidak bisa dipilih di `SchedulePicker`.

Interaktivitas & realtime:
- Registrasi/pembatalan/pindah memancarkan `OpenQuotaUpdated`; counter sisa kuota turun/naik
  live tanpa reload di layar pengunjung lain.
- Hari yang penuh otomatis non-aktif di picker; submit ke hari penuh ditolak + kuota refresh.
- Dengan `VITE_REVERB_ENABLED=false`, kuota tetap akurat via refetch saat buka langkah & submit.

UI:
- Popup muncul sekali per event per pengunjung; ESC/scrim menutup; fokus terkunci.
- Export per hari menghasilkan nama + WhatsApp + headcount + add-on.

---

## 16. Area Implementasi (ringkas)

- **Migrations:** `open_events`, `open_event_days`, `open_registrations`.
- **Models:** `OpenEvent`, `OpenEventDay`, `OpenRegistration`.
- **Service:** `OpenRegistrationService` (store atomic, move, cancel, kuota).
- **Events/Realtime:** `OpenQuotaUpdated` (`app/Events`) + channel `PUBLIC_OPEN_CHANNEL` di
  `realtime/echo.ts`; langganan di `useIsturaData.ts` (pola `.schedule.updated`).
- **Controllers:** `Public/OpenRegistrationController`, `Admin/OpenEventController` +
  `Admin/OpenRegistrationController`.
- **FormRequests:** store publik, precheck, admin create/update event, update day, move.
- **Routes:** grup publik (`throttle:public-open`) + grup admin (`admin-access`).
- **Frontend:** form publik Istura Open, popup + banner, screen admin (2 tab) di
  `components/admin`, entri `ADMIN_MENU`, util export turunan dari `exportBookings.ts`.
  Tambah `Screen` value baru (mis. `"open"`) di `App.tsx` + `domain/types`, komponen
  `IsturaOpenWizard`, dan item `Navigation` saat event aktif.
- **Bootstrap publik:** sertakan ringkasan event aktif di `ContentController::bootstrap`.

---

## 17. Lampiran — Glosarium

- **Headcount:** total kepala satu pendaftaran = 1 (pendaftar) + jumlah add-on.
- **self_select:** pendaftar memilih hari sendiri saat submit.
- **pool:** (ditunda) pendaftar masuk kolam global, admin mendistribusikan hari.
- **release_mode:** cara hari dibuka — `simultaneous` (serentak) atau `sequential` (bertahap).
- **Event aktif:** satu `open_events` dengan `is_active = true`; menjadi sumber banner publik.
- **`OpenQuotaUpdated`:** event broadcast publik yang memicu klien menyegarkan sisa kuota per hari (kuota live).
