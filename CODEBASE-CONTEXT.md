# ISTURA App — Codebase Context & Mapping

> Dokumen acuan utama struktur kode untuk agent/developer sebelum mengubah apa pun.
> Wajib dibaca bersama `PRD-ISTURA-APP.md` (produk, business rules, DB schema lengkap),
> `IsturaOpen.md` (modul roadmap), dan `AGENTS.md` (aturan kerja).
>
> Jika struktur/flow berubah, **perbarui dokumen ini** pada bagian yang relevan.

---

## 1. Ringkasan Sistem

ISTURA Web = monolit **Laravel 13 (PHP 8.4) + React 19 (Vite, TypeScript)** satu origin.
Backend melayani REST API + WebSocket (Reverb); frontend SPA React dihosting via
`resources/views/app.blade.php`. Data di MySQL. Auth admin via Sanctum (SPA cookie session).

- **Domain:** booking kunjungan publik ke Istana Kepresidenan Yogyakarta (program ISTURA).
- **Dua pengguna:** Publik (pengunjung rombongan) & Admin/Super Admin (Humas).
- **Bahasa & timezone:** Indonesia, Asia/Jakarta.

| Layer | Teknologi |
|-------|-----------|
| Backend | Laravel 13, PHP 8.4 |
| DB | MySQL (utf8mb4_unicode_ci) |
| Auth | Laravel Sanctum (cookie SPA) + 2FA TOTP |
| Realtime | Laravel Reverb + laravel-echo / pusher-js (flag `VITE_REVERB_ENABLED`) |
| Frontend | React 19 + TypeScript + Vite 8, GSAP, lucide-react |
| Ekspor (browser) | pdfmake, exceljs, jszip, html-to-image |
| Cache/Queue/Session | database driver |
| Storage file | local disk (`storage/app/private` untuk surat booking; `storage/app/public` untuk aset CMS) |

---

## 2. Backend Context & Mapping (Laravel)

Pola: **thin controllers + Services**. Validasi di FormRequest, bentuk JSON di Resources
(camelCase mirror tipe React), broadcasting via Events, cache publik via `Support/PublicCache`.

### 2.1 Controllers (`app/Http/Controllers`)
- **Base/Health:** `Controller.php`; `HealthController.php` → `GET /api/health`.
- **Auth/** :
  - `AuthController.php` — `login`, `logout`, `me` (Sanctum session).
  - `TwoFactorController.php` — status/setup/confirm/verify/disable, recovery-codes, challenge.
- **Public/** :
  - `BookingController.php` — `precheck`, `store` booking publik.
  - `ContentController.php` — `bootstrap`, faqs, contacts, schedule, hero, letter, site-content, wa-templates.
  - `FeedbackController.php` — `show`/`store` feedback by booking code+token.
- **Admin/** :
  - `DashboardController.php` — KPI dashboard (invokable).
  - `BookingController.php` — index/show/store booking admin + aksi: accept, reject, reschedule, cancelReschedule, segments, move langsung, complete, document.
  - `ScheduleController.php` — index, storeSlot, destroySlot, storeRange, store/destroy short-notice slot.
  - `FeedbackController.php` — index/show.
  - `CmsController.php` — CRUD faqs, contacts, wa-templates, hero, letter, site-content; upload aset landing (logo navbar/footer, background CTA, dan foto aktivitas) dalam satu save multipart.
  - `UserController.php` — manajemen admin (super-admin only).
  - `AuditLogController.php` — index audit log.

### 2.2 Services (`app/Services`) — logika domain
- `BookingService.php` — siklus hidup booking, split kloter (`SLOT_CAPACITY = 80`), booking manual admin dengan surat opsional, pindah langsung, koreksi total eksplisit, dan overbook terkontrol memakai transaksi + `booking_slot_locks`; aksi internal berisiko memakai checkbox konfirmasi dan catatan audit otomatis.
- `ScheduleService.php` — perhitungan horizon/slot, status default runtime, `buildHorizon()`, kapasitas peserta per slot, serta validasi atomik slot dadakan publik H/H+1.
- `BookingCodeGenerator.php` — kode unik `ISTURA-YYYY-NNNN` (via `booking_sequences` lock).
- `TwoFactorService.php` — TOTP + recovery code + trusted device.
- `NationalHolidaySyncService.php` — sinkron tanggal merah dari provider.
- `AuditLogger.php` — `record()` entri audit + konteks request.
- `CmsImageService.php` — pipeline gambar CMS raster-only: validasi dimensi/piksel, resize, konversi WebP (termasuk preservasi transparansi logo), dan penyimpanan disk publik.
- `IndonesianDate.php` — format tanggal/locale Indonesia.

### 2.3 Models (`app/Models`)
`AuditLog`, `Booking`, `BookingSlot`, `Faq`, `Feedback`, `FooterContact`,
`NationalHoliday`, `ScheduleOverride`, `SiteSetting`, `TrustedDevice`, `User`, `WaTemplate`,
`OpenEvent`, `OpenEventDay`, `OpenRegistration` (modul Istura Open).
> Skema kolom lengkap ada di `PRD-ISTURA-APP.md` §6.

#### Istura Open (modul terpisah, lihat `IsturaOpen.md`)
- **Tabel:** `open_events` (termasuk kolom `poster_path` untuk poster/flyer opsional, `promo_subtitle` & `banner_text` untuk copy promo per-event, serta `archived_at` untuk arsip operasional), `open_event_days`, `open_registrations` (termasuk kolom `city` untuk asal kota pendaftar), `open_registration_sequences` (counter kode).
- **Tanggal event:** create/update menerima `dates[]` eksplisit, sehingga event dapat berisi satu hari, rentang berurutan, atau tanggal loncat. Event baru dan tanggal baru pada event lama tidak boleh berada di masa lampau; tanggal lampau yang sudah menjadi bagian event berjalan tetap dapat dipertahankan saat edit. `start_date`/`end_date` tetap menyimpan batas minimum/maksimum untuk kompatibilitas; sumber hari operasional tetap baris `open_event_days`. Hari yang sudah memiliki pendaftar tidak dapat dikeluarkan dari event.
- **Lifecycle event:** `OpenEventResource` mengembalikan `lifecycleStatus` (`draft`/`active`/`past`/`archived`), `isPast`, `isArchived`, `archivedAt`, dan `registrationsCount`. Event aktif yang sudah lewat atau diarsipkan tidak dikembalikan ke publik dan tidak bisa menerima pendaftaran baru. Event arsip/lewat ditolak server untuk mutasi operasional (update event/hari/poster, move/cancel pendaftar, delete), sementara read/export dan pulihkan arsip tetap boleh. Admin memakai arsip untuk event yang sudah punya pendaftar; delete permanen hanya untuk draft nonaktif tanpa riwayat pendaftar.
- **Service:** `OpenRegistrationService` (store atomic dengan `lockForUpdate` baris event → no overbooking, dedup 1 NIK + 1 WhatsApp aktif/event, self/admin cancel, admin move + overbook, quotaSummary live; `activeEvent` hanya memilih event aktif yang belum arsip/belum lewat; `lookupByIdentity` butuh NIK **dan** WhatsApp). Isolated dari `BookingService`.
- **Pemblokiran jadwal rombongan:** `ScheduleService` menutup tanggal yang dipakai event Istura Open **aktif dan belum arsip** untuk booking rombongan, per hari (`OpenEventDay.is_open = true`). Tanggal terblokir tampil `Closed` dengan `closureReason.type = istura_open` (label "Tutup — Istura Open") di kalender publik & wizard, dan `slotStatusFor`/`slotStatusesFor` menolak booking baru (mengalahkan override "Available", tetap menampilkan booking aktif yang sudah ada). Hari yang admin set "Tutup" tetap bisa dibooking rombongan. Mutasi event (store/update/activate/deactivate/archive/updateDay/poster) memanggil `PublicCache::bumpScheduleVersion()` agar kalender ter-refresh.
- **Peringatan konflik saat membuka hari:** `updateDay` saat transisi `is_open false→true` mendeteksi booking rombongan aktif (`Booking::ACTIVE_STATUSES` + `booking_slots` active/proposed, mencakup kloter multi-segmen) pada tanggal itu. Bila ada dan request belum membawa `acknowledgeConflicts`, response 422 berisi `conflicts[]` (`code`, `time`, `groupSize`, `status`, `statusLabel`). Admin di `DayCard` melihat panel peringatan (saran jadwalkan ulang/batalkan di Booking) dengan tombol "Batal"/"Tetap buka"; "Tetap buka" mengirim ulang `acknowledgeConflicts: true` dan dicatat di audit. Non-blocking by design — tidak memindahkan/membatalkan booking otomatis.
- **Kode:** `OpenRegistrationCodeGenerator` → `ISTURA-OPEN-{year}-{NNNN}` (pola `booking_sequences`).
- **Event broadcast:** `OpenQuotaUpdated` (ShouldBroadcastNow) ke channel publik `public.open`, event `.open.quota-updated` (kuota, status, poster, dan copy promo live). `ScheduleUpdated` ikut dipancarkan ketika event diaktifkan/dinonaktifkan atau hari aktif dibuka/ditutup agar landing dan wizard rombongan langsung mengikuti blokir tanggal Istura Open.
- **Controllers:** `Public/OpenRegistrationController` (show/precheck/store/lookup/cancel — lookup & cancel butuh NIK + WhatsApp dan tetap tersedia setelah window pendaftaran ditutup selama event masih aktif/belum lewat), `Admin/OpenEventController` (index/store/update/destroy/activate/deactivate/archive/unarchive/updateDay/uploadPoster/deletePoster/export), `Admin/OpenRegistrationController` (index/move/cancel). `POST open-events/{event}/archive` menonaktifkan dan menyimpan event sebagai arsip; `POST open-events/{event}/unarchive` memulihkan ke draft; `DELETE open-events/{event}` hanya menghapus event nonaktif tanpa riwayat pendaftar.
- **Poster/flyer (opsional):** `POST/DELETE /api/admin/open-events/{event}/poster` (multipart field `poster`, reuse `CmsImageService` → WebP di `cms/open-posters`, maks 5 MB, **maks 2800×3600 px — orientasi bebas**, rollback + cleanup file lama). Validasi server berpesan Bahasa Indonesia actionable; frontend (`PosterCard` + Create modal) pra-validasi tipe/ukuran/dimensi sebelum upload. Batas upload PHP server dinaikkan ke 8M/10M via `deploy/aws/deploy.sh` (file `conf.d` PHP-FPM) agar tidak ditolak "failed to upload". `posterUrl` ikut di resource admin + payload publik. Bila ada, `IsturaOpenPromo` menampilkan gambar di atas teks pada popup; bila kosong, popup tetap tampilan ringkas.
- **Copy promo per-event:** kolom `promo_subtitle` & `banner_text` (editable via `PUT open-events/{event}`, field `promoSubtitle`/`bannerText`, dikelola di card "Teks Promo" pada tab Pengaturan). `IsturaOpenPromo` memakai `event.promoSubtitle` untuk subjudul popup (fallback: kalimat default dari tanggal) dan `event.bannerText` untuk teks banner berjalan (fallback: `siteContent.openBanner.tickerText` global → default).
- **Reload & health realtime admin:** tombol "Muat ulang" berada di blok konteks halaman sisi kiri top bar `AdminShell`, terpisah dari akun. Di sebelahnya ada indikator `Realtime aktif` / `Menghubungkan` / `Sinkronisasi cadangan`. Menekan tombol memanggil `useIsturaData.reloadAdmin()` (re-fetch bookings/feedbacks/schedule via nonce + `refetchOpenEvent`) dan me-remount layar aktif via `key` di `AdminApp` untuk data milik komponen.
- **Requests:** `Public/{Store,Precheck,Lookup,Cancel}OpenRegistrationRequest`, `Admin/{StoreOpenEvent,UpdateOpenEvent,UpdateOpenEventDay,MoveOpenRegistration}Request`.
- **Resources:** `OpenEventResource` (termasuk `posterUrl`, lifecycle, dan jumlah pendaftar), `OpenEventDayResource` (link WA hanya admin), `OpenRegistrationResource`.
- **Keamanan:** link grup WhatsApp tidak pernah muncul di endpoint/bootstrap publik; hanya dikembalikan pada response sukses register/lookup, dan lookup/cancel publik kini butuh NIK + WhatsApp yang cocok (mencegah enumerasi via NIK saja). Hari tak bisa dibuka/diaktifkan tanpa link. Rate limit `public-open`. `is_active` default false (kill-switch).
- **Bootstrap:** ringkasan event aktif (`openEvent`, tanpa link WA, termasuk `posterUrl` dan `registrationWindowOpen`) ikut di `ContentController::bootstrap`. Saat window tutup tetapi event masih aktif/belum lewat, day public dikirim `isOpen=false` agar wizard menjadi recovery-only untuk cek/batalkan pendaftaran, bukan pendaftaran baru.

### 2.4 Requests / Resources / Middleware / lainnya
- **Requests** (`app/Http/Requests`): root `ScheduleRangeRequest`; `Auth/LoginRequest`;
  `Public/` (PrecheckBookingIdentity, StoreBooking, StoreFeedback); `Admin/` (15 request: Index*, Update*, Store*, Destroy*, Reschedule).
  `UpdateSiteContentRequest` menerima JSON biasa atau multipart (`content` + `navLogo`/`footerLogo`/`ctaBackground`/`activityImages[index]`) dengan validasi gambar fail-closed; payload `siteContent` juga memuat copy fixed-flow untuk wizard booking (`bookingWizard`) dan feedback (`feedbackWizard`). Pada feedback, label enam sumber informasi dapat diedit tetapi kode datanya tetap (`social_media`, `friends_family`, `school_institution`, `web_search`, `previous_visit`, `other`); pilihan highlight/perbaikan dibatasi maksimal 12 item dan 80 karakter per item pada CMS maupun submission publik.
- **Resources** (`app/Http/Resources`): `AuditLogResource`, `BookingResource`, `FaqResource`,
  `FeedbackResource`, `FooterContactResource`, `PublicVisitDayResource`, `UserResource`, `VisitDayResource`, `WaTemplateResource`.
  `VisitDayResource` dan `PublicVisitDayResource` sama-sama membawa metadata hari `closureReason`/`holiday` agar kalender publik/admin tidak kehilangan label alasan tutup saat state jadwal dipakai ulang.
- **Middleware** (`app/Http/Middleware`): `AddSecurityHeaders`, `EnsureAdmin` (alias `admin-access`),
  `EnsureAdminSessionFresh`, `EnsureOperator` (alias `operator` — blokir viewer dari mutasi),
  `EnsureSuperAdmin` (alias `super-admin`), `EnsureTwoFactorVerified`.
- **Roles**: 3 tier hierarkis — `super_admin` (semua + kelola user), `admin` (semua kecuali kelola user), `viewer` (read-only + download dokumen + export, tanpa audit log). Konstanta di `User::ROLE_*`. Helper: `isAdmin()` (semua role), `isOperator()` (admin + super_admin), `isSuperAdmin()`. Mutation FormRequest dan policy memakai `isOperator()` sebagai lapis defense-in-depth selain middleware route `operator`; request baca tetap memakai `isAdmin()` sesuai akses viewer.
- **Events** (`app/Events`): `BookingCreated`, `BookingStatusChanged`, `FeedbackSubmitted`, `ScheduleUpdated` (broadcast ke channel `admin.bookings`).
- **Policies** (`app/Policies`): `BookingPolicy`, `FeedbackPolicy`, `ScheduleOverridePolicy`.
- **Rules** (`app/Rules`): `SafePublicUrl`, `VisitTime`.
- **Support** (`app/Support`): `PublicCache` (rememberCms + TTL/versi), `SiteContentDefaults`,
  `SeoMeta` (canonical URL, metadata, JSON-LD, sitemap, robots). `SiteContentDefaults` adalah fallback utama untuk konten landing, widget WhatsApp, banner Istura Open, serta copy wizard publik.
- **Console/Commands**: `ExpirePendingBookings` (`bookings:expire-pending`), `SyncIndonesianHolidays` (`holidays:sync-id`), `PruneAuditLogs` (`audit:prune`), `CleanupLunchBreakSlots`, `ResetUserTwoFactor`.

### 2.5 Routes (`routes/`)
- **api.php** — 3 grup: `public/*` (rate-limited; termasuk `open-event` + `open-registrations/*` throttle `public-open`), `auth/*` (login throttle + sanctum), `admin/*` (middleware `admin-access`; READ routes terbuka untuk viewer, MUTATION routes dibungkus middleware `operator`, nested `super-admin` untuk users). `cms/site-content` menerima PUT JSON dan POST multipart untuk upload aset gambar landing.
- **web.php** — `/robots.txt`, `/sitemap.xml`, `/info/alur-kunjungan` (OG tags WA preview)
  lalu catch-all `/{any?}` → `view('app')` (SPA dengan metadata/JSON-LD dan konten
  ringkasan server-rendered untuk crawler). Root homepage memakai preview sosial khusus
  `/assets/istura-home-preview.jpg`, sedangkan `/info/alur-kunjungan` tetap memakai preview
  peraturan/alur untuk link pembooking yang disetujui. Regex catch-all mengecualikan `api`.
- **channels.php** — private `admin.bookings` (gated `$user->isAdmin()`).
- **console.php** — jadwal: `audit:prune` 03:00, `bookings:expire-pending` tiap 5 menit, `holidays:sync-id` 02:30.

### 2.6 Database
- `database/migrations` (~43 file). Tabel inti: users, bookings, booking_sequences, booking_slots, booking_slot_locks, schedule_overrides, feedbacks, faqs, wa_templates, footer_contacts, site_settings, audit_logs, trusted_devices, national_holidays + tabel sistem (sessions, cache, jobs, personal_access_tokens). `bookings.source`/`created_by_admin_id` membedakan booking publik dan buatan admin. `schedule_overrides.short_notice_*` menyimpan audience admin/publik, tenggat, dan kapasitas booking dadakan. `feedbacks` menyimpan dua rating tambahan (`guide_quality`, `facility_comfort`) dan profil kunjungan (`visited_before`, `discovery_source`, `discovery_source_other`); semuanya nullable agar data lama tetap kompatibel.
- `database/seeders`: `DatabaseSeeder`, `FaqSeeder`, `FooterContactSeeder`, `SiteSettingSeeder`, `UserSeeder`, `WaTemplateSeeder` (+ `seeders/data/*.json`).
- `database/factories`: `UserFactory`.

---

## 3. Frontend Context & Mapping (React — `resources/js`)

Router **berbasis state** (bukan URL): `screen` dari `useIsturaData`. Hanya 1 server route
non-API (halaman OG info). Auth via cookie Sanctum.

### 3.1 Entry & root
- `main.tsx` — entry, `createRoot` render `<App/>` (StrictMode), import fonts + `styles.css`.
- `App.tsx` — root; routing via `screen`; lazy-load `HomeAnimationLayer`, `BookingWizard`, `FeedbackScreen`, `AdminApp`.
- `constants.ts` — konstanta app-wide (termasuk `ADMIN_MENU`). `styles.css` — global. `echo.js` — bootstrap Echo legacy global.

### 3.2 State & data
- `hooks/useIsturaData.ts` — **state pusat**: screen, schedules, bookings, feedbacks, faqs, contacts, waTemplates, hero, letter, siteContent, adminSession, adminTab, loading, cmsSync.
- `hooks/useIdleTimeout.ts` — idle timeout sesi. `hooks/index.ts` — barrel.

### 3.3 API layer (`api/`)
- `client.ts` — fetch wrapper Sanctum (CSRF priming, `ApiError`/`ValidationError`, listener auth-failure admin).
- `adapters.ts` — adapter response. Per-domain: `admin.ts`, `auth.ts`, `bookings.ts`, `cms.ts`, `feedback.ts`, `schedule.ts`, `openEvents.ts` (Istura Open publik + admin).

### 3.4 Domain & realtime & lib
- `domain/`: `types.ts` (termasuk `Screen`), `booking.ts`, `schedule.ts`, `weeklyPoster.ts`.
- `realtime/echo.ts` — singleton Echo (Reverb/Pusher), lazy, state machine koneksi, gated `VITE_REVERB_ENABLED`. Channel: `admin.bookings` (private), `public.schedule`, `public.open`. `useIsturaData` melakukan resync setelah subscribe/reconnect dan polling backoff hanya saat realtime gagal/disabled; status channel privat admin juga dipantau agar booking/feedback tetap sinkron bila autentikasi channel gagal. Event booking/feedback memakai `ShouldBroadcastNow` setelah commit supaya tidak bergantung pada worker queue broadcast.
- `lib/`: `assets.ts`, `bookingDraft.ts` (autosave draft), `date.ts`, `legacyShims.ts`, `waActions.ts`, `whatsapp.ts`.
- `animations/`: `HomeAnimationLayer.tsx`, `useHomeAnimations.ts` (GSAP).

### 3.5 Components (`components/`)
- **admin/**: `AdminApp.tsx`, `AdminShell.tsx`, `AdminDashboard.tsx`, `AdminCmsManagers.tsx` (preview + upload langsung logo navbar/footer, background CTA, dan foto panel aktivitas; semua aset ikut satu draft/save Landing Page. Tab "Wizard Publik" mengedit copy fixed-flow untuk `BookingWizard` dan `FeedbackScreen` tanpa mengubah step/validasi/ikon/gambar), `AdminFeedbackList.tsx`, `AdminSystemPages.tsx`, `BookingScreen.tsx` (Atur Kloter dengan total terkunci/koreksi eksplisit dan checkbox konfirmasi untuk risiko, Pindah Jadwal Langsung, Buat Booking Manual dengan mode kloter otomatis/manual, surat opsional, dan tanpa textarea catatan internal), `ScheduleManager.tsx` (termasuk konfigurasi Booking Dadakan admin/publik per slot), `IsturaOpenManager.tsx` (2 tab: Pengaturan & Hari + Pendaftar), `ExportModals.tsx`, `WeeklyPosterModal.tsx`, `TwoFactorChallenge.tsx`, `TwoFactorSetup.tsx`.
- **booking/**: `BookingWizard.tsx` (wizard 8 langkah; teks step, helper, MIKY, label form, upload, persetujuan, sukses, dan tombol berasal dari `siteContent.bookingWizard` dengan fallback default. Rombongan >80 mendapat rincian kloter + CTA diskusi awal di Data Instansi; setelah memilih jam, callout penyesuaian + CTA yang sama tampil sebagai card horizontal di bawah kalender dan daftar jam, dengan pesan terisi instansi, jumlah peserta, tanggal, dan jadwal per kloter). **feedback/**: `FeedbackScreen.tsx` (wizard 4 langkah: penilaian inti → tentang kunjungan → detail pengalaman → komentar; copy, label rating, label sumber informasi, dan opsi chip berasal dari `siteContent.feedbackWizard`). **home/**: `HomeScreen.tsx`. **open/**: `IsturaOpenWizard.tsx` (wizard publik 5 langkah dalam shell/action bar yang sama dengan wizard rombongan, tetapi panel konteks event menggantikan MIKY; pilih hari → data diri → add-on → tinjau → sukses + tombol grup WA; ada lookup/self-cancel via NIK+WhatsApp dan pilihan hari direset otomatis bila realtime menutup/menghabiskan kuota), `IsturaOpenPromo.tsx` (popup sekali per event per pengunjung + banner persisten).
- **layout/**: `Navigation.tsx`, `Footer.tsx` (footer publik tanpa shortcut admin), `FloatingContact.tsx` (FAB WhatsApp mengambang di halaman publik selain `booking`; expand jadi kartu MIKY + quick-topic prefill WA + tautan Instagram. Nomor dari `contacts`/CMS; sapaan & daftar topik dari `siteContent.floatingContact` (editable di admin Landing Page → "Widget WhatsApp Mengambang"), subtitle animasi typewriter). **ui/**: `DetailItem`, `LoadingStates`, `Pagination`, `StatCard`, `StatusBadge`. **icons/**: `SocialIcons.tsx`. `MikyGuide.tsx` (maskot).

### 3.6 Ekspor (browser, root `resources/js`)
- `exportBookings.ts`, `exportFeedback.ts`, `exportMonthlyReport.ts`, `exportWeeklyPoster.ts`, `exportShared.ts`, `exportOpenRegistrations.ts` (Istura Open → Excel `.xlsx` berstilir, per hari/seluruh event; ExcelJS lazy-import).
- **PDF laporan**: `exportPdfShared.ts` (scaffolding pdfmake bersama: loader+VFS, token warna/style, cover/KPI/footer, tabel status, dan section "Suara Pengunjung" via `computeFeedbackInsights` + `buildFeedbackVoiceBody`/`buildFollowUpNodes`). Dipakai oleh `exportMonthlyReport.ts` (booking+feedback gabung, Dashboard), `exportBookingReport.ts` (booking saja: ringkasan eksekutif + distribusi status + tabel ringkas Top-40, **tanpa NIK**), dan `exportFeedbackReport.ts` (feedback saja: ringkasan + voice of visitor). Modal Booking & Feedback (`ExportModals.tsx`) punya toggle **Excel/PDF** memakai scope+periode yang sama.

### 3.7 Build/config
- `package.json` scripts: `dev` (vite), `build` (vite build). `vite.config.js` (root). `tsconfig.json` alias `@/* → resources/js/*`.

> Catatan: ada dua file Echo — `resources/js/echo.js` (legacy global) dan `resources/js/realtime/echo.ts` (singleton typed). Gunakan `realtime/echo.ts` untuk kode baru.

---

## 4. Fitur Utama

Publik: landing CMS-driven, kalender jadwal 2 bulan, booking wizard 8 langkah (precheck identitas, autosave, split kloter otomatis, CTA diskusi penyesuaian kloter setelah jadwal dipilih), feedback pasca-kunjungan via token.
Admin: dashboard KPI realtime, manajemen booking (siklus hidup + segments + unduh surat + pesan WA tergenerasi), manajemen jadwal (slot/range override), feedback + ekspor, CMS penuh, 2FA, audit log, manajemen admin (super-admin), ekspor (Excel/PDF/ZIP, laporan bulanan, poster mingguan).
Modul terpisah **Istura Open** sudah diimplementasi (lihat `IsturaOpen.md` & §2.3): pendaftaran perorangan per-event, tanggal pilihan, kuota harian berbasis headcount, link grup WA, lifecycle draft/aktif/lewat/arsip, dan realtime via channel `public.open`.

> Daftar lengkap requirement (FR/NFR/BR) ada di `PRD-ISTURA-APP.md` §2–§3.

---

## 5. Flow Aplikasi (ringkas)

### 5.1 Flow Publik
- **Lihat info & jadwal:** load `/api/public/bootstrap` → telusuri seksi → kalender slot (Available/Held/Booked/Closed) → "Mulai Booking".
- **Booking (8 langkah):** Selamat Datang → Contact Person (precheck NIK/WA) → Instansi (rincian pembagian + CTA diskusi awal bila >80) → Pilih Jadwal (card horizontal penyesuaian + CTA WhatsApp setelah jam dipilih) → Upload Surat (≤5MB) → Review → Pernyataan → Selesai (kode `ISTURA-YYYY-NNNN`, status Pending). Submit mengunci slot via transaksi DB + broadcast realtime ke admin; diskusi WhatsApp tidak mengubah slot sebelum admin melakukan override manual.
- **Feedback:** admin klik "Tandai Selesai" → modal isi **link dokumentasi HTTPS opsional dari host yang disetujui** (`DOCUMENTATION_LINK_HOSTS`) → set Completed (link disimpan di `bookings.documentation_link`) → kirim tautan WA (template `Completed` memakai variabel `{dokumentasi}` = link foto/dokumentasi & `{link}` = kuesioner/feedback kode+token) → pengunjung mengisi rating keseluruhan/booking/layanan, kualitas pemandu, kebersihan & fasilitas, riwayat kunjungan, sumber informasi, rekomendasi, aspek, dan komentar → submit sekali per booking.

### 5.2 Flow Admin
- **Login (+2FA):** email+password (progressive delay) → bila 2FA aktif tampil challenge TOTP/recovery + trusted device → dashboard (absolute session lifetime).
- **Booking lifecycle:** Pending → Accept/Reject/Reschedule; Accepted → Complete/Reschedule; Reschedule → Accept/Reject/Cancel; Expired → Reschedule/Reject. Alasan teks tetap dipakai untuk aksi user-facing seperti reject/reschedule karena masuk konteks pesan WhatsApp. Aksi internal berisiko (Atur Kloter dengan koreksi/overbook/kloter >80, Pindah Jadwal Langsung, Buat Booking Manual) memakai checkbox konfirmasi dan sistem menulis catatan audit otomatis, tanpa textarea catatan admin. Di detail booking, catatan user-facing tetap tampil sebagai "Catatan admin", sedangkan catatan sistem otomatis dari aksi internal diringkas sebagai "Riwayat sistem" collapsed agar panel kanan tetap ringkas; audit lengkap tetap tersedia di riwayat aktivitas/payload. Pindah Jadwal Langsung hanya untuk Pending/Accepted, tidak meminta persetujuan formal kedua, menampilkan peringatan pada Accepted, memakai picker slot seperti modal reschedule, mempertahankan bentuk kloter aktif saat ini (termasuk booking manual 2x100 peserta), dan menyimpan tanpa membuka WhatsApp otomatis; status Reschedule tetap memakai aksi konfirmasi/tawarkan ulang/batal. Dropdown tanggal untuk Tawarkan Jadwal Lain hanya memuat tanggal dengan slot tersedia yang cukup untuk kloter, sedangkan Pindah Jadwal Langsung dan Booking Manual menampilkan label ringkas slot kosong/penuh/tidak ada jam operasional; izin gabung ke slot terisi baru muncul saat admin memilih jam yang sudah terpakai dan ditampilkan sebagai item konfirmasi compact dengan detail booking kecil, bukan alert besar terpisah. Buat Booking Manual dapat melampirkan surat permohonan opsional, default memakai kloter otomatis berurutan, atau mode manual untuk mengatur jam dan jumlah peserta tiap kloter pada tanggal yang sama, lalu menyimpan langsung tanpa membuka WhatsApp otomatis. Aksi lifecycle: audit log + broadcast + invalidasi cache + pesan WA siap salin.
- **Jadwal:** tutup/buka slot tunggal atau rentang tanggal (override); default dihitung runtime; slot ber-booking aktif terlindungi.
- **CMS:** edit FAQ/ketentuan/kontak/hero/landing/template WA → simpan → bump cache publik. Logo navbar/footer, background CTA, dan foto panel "Aktivitas di Istana" dipilih langsung di editor Landing Page, dipreview lokal, lalu saat save dikonversi otomatis ke WebP; file lama dibersihkan setelah konfigurasi baru berhasil tersimpan. Copy wizard publik (booking + feedback), termasuk judul/isi/tombol callout penyesuaian kloter (`{jumlahKloter}`), diedit dari tab "Wizard Publik" di Landing Page dengan struktur step tetap.
- **Users (super-admin):** CRUD akun admin. **Dashboard/Feedback/Audit/Ekspor:** lihat KPI, feedback, audit dengan filter, ekspor data.

### 5.3 State booking
`Pending → Accepted → Completed` (+feedback); cabang `Rejected`, `Reschedule` (accept/cancel/reject), `Expired` (TTL/lewat jadwal). Detail diagram di `PRD-ISTURA-APP.md` §4.3–§4.4.

---

## 6. Verifikasi & Perintah

- Laravel test: `php artisan test` (atau filter relevan). Konfig di `phpunit.xml`, test di `tests/Feature` & `tests/Unit`.
- Frontend build: `npm run build`. Dev: `npm run dev` (Vite), `php artisan serve`, `php artisan reverb:start`.
- QA Playwright: skrip di `scripts/` (mis. `e2e-user-flow.mjs`) saat dev server hidup.

### 6.1 CI/CD production

- Push ke `main` menjalankan `.github/workflows/deploy.yml`: test backend SQLite + build frontend harus lolos sebelum deploy.
- GitHub Actions memakai OIDC role AWS berumur pendek, mengunggah `git archive` ke bucket S3 privat, lalu menjalankan deploy di EC2 melalui AWS Systems Manager (SSM). Port SSH production tidak dibuka untuk runner GitHub.
- Script `deploy/aws/deploy.sh` melakukan maintenance mode, sinkronisasi source dengan pengecualian data persisten (`.env`, `storage/app`, session/cache/log), install/build, migration, cache Laravel, restart Supervisor, dan health check origin.
- Target production: EC2 `i-072b0ca3970f635b6` region `ap-southeast-2`, path `/var/www/istura`; endpoint publik diverifikasi kembali setelah SSM sukses.

---

## 7. Catatan Keamanan (ringkas)
- NIK terenkripsi (`Crypt`), `nik_masked`/`nik_hash` untuk tampilan/dedup.
- Surat privat di `storage/app/private/booking-letters/`, akses via endpoint admin.
- Rate-limit endpoint publik; upload validasi mime + ≤5MB; security headers di semua respons; absolute session lifetime admin.
