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
| Storage file | local disk (`storage/app/private`) |

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
  - `BookingController.php` — index/show + aksi: accept, reject, reschedule, cancelReschedule, segments, complete, document.
  - `ScheduleController.php` — index, storeSlot, destroySlot, storeRange.
  - `FeedbackController.php` — index/show.
  - `CmsController.php` — CRUD faqs, contacts, wa-templates, hero, letter, site-content.
  - `UserController.php` — manajemen admin (super-admin only).
  - `AuditLogController.php` — index audit log.

### 2.2 Services (`app/Services`) — logika domain
- `BookingService.php` — siklus hidup booking, split kloter (`SLOT_CAPACITY = 80`), anti-overbook (transaksi + `active_slot_key`).
- `ScheduleService.php` — perhitungan horizon/slot, status default runtime, `buildHorizon()`.
- `BookingCodeGenerator.php` — kode unik `ISTURA-YYYY-NNNN` (via `booking_sequences` lock).
- `TwoFactorService.php` — TOTP + recovery code + trusted device.
- `NationalHolidaySyncService.php` — sinkron tanggal merah dari provider.
- `AuditLogger.php` — `record()` entri audit + konteks request.
- `IndonesianDate.php` — format tanggal/locale Indonesia.

### 2.3 Models (`app/Models`)
`AuditLog`, `Booking`, `BookingSlot`, `Faq`, `Feedback`, `FooterContact`,
`NationalHoliday`, `ScheduleOverride`, `SiteSetting`, `TrustedDevice`, `User`, `WaTemplate`,
`OpenEvent`, `OpenEventDay`, `OpenRegistration` (modul Istura Open).
> Skema kolom lengkap ada di `PRD-ISTURA-APP.md` §6.

#### Istura Open (modul terpisah, lihat `IsturaOpen.md`)
- **Tabel:** `open_events`, `open_event_days`, `open_registrations`, `open_registration_sequences` (counter kode).
- **Service:** `OpenRegistrationService` (store atomic dengan `lockForUpdate` baris event → no overbooking, dedup 1 NIK + 1 WhatsApp aktif/event, self/admin cancel, admin move + overbook, quotaSummary live). Isolated penuh dari `BookingService`/`ScheduleService`.
- **Kode:** `OpenRegistrationCodeGenerator` → `ISTURA-OPEN-{year}-{NNNN}` (pola `booking_sequences`).
- **Event broadcast:** `OpenQuotaUpdated` (ShouldBroadcastNow) ke channel publik `public.open`, event `.open.quota-updated` (kuota live). Dipancarkan saat register/cancel/move/admin toggle.
- **Controllers:** `Public/OpenRegistrationController` (show/precheck/store/lookup/cancel), `Admin/OpenEventController` (index/store/update/activate/deactivate/updateDay/export), `Admin/OpenRegistrationController` (index/move/cancel).
- **Requests:** `Public/{Store,Precheck,Lookup,Cancel}OpenRegistrationRequest`, `Admin/{StoreOpenEvent,UpdateOpenEvent,UpdateOpenEventDay,MoveOpenRegistration}Request`.
- **Resources:** `OpenEventResource`, `OpenEventDayResource` (link WA hanya admin), `OpenRegistrationResource`.
- **Keamanan:** link grup WhatsApp tidak pernah muncul di endpoint/bootstrap publik; hanya dikembalikan pada response sukses register/lookup. Hari tak bisa dibuka/diaktifkan tanpa link. Rate limit `public-open`. `is_active` default false (kill-switch).
- **Bootstrap:** ringkasan event aktif (`openEvent`, tanpa link WA) ikut di `ContentController::bootstrap`.

### 2.4 Requests / Resources / Middleware / lainnya
- **Requests** (`app/Http/Requests`): root `ScheduleRangeRequest`; `Auth/LoginRequest`;
  `Public/` (PrecheckBookingIdentity, StoreBooking, StoreFeedback); `Admin/` (15 request: Index*, Update*, Store*, Destroy*, Reschedule).
- **Resources** (`app/Http/Resources`): `AuditLogResource`, `BookingResource`, `FaqResource`,
  `FeedbackResource`, `FooterContactResource`, `PublicVisitDayResource`, `UserResource`, `VisitDayResource`, `WaTemplateResource`.
- **Middleware** (`app/Http/Middleware`): `AddSecurityHeaders`, `EnsureAdmin` (alias `admin-access`),
  `EnsureAdminSessionFresh`, `EnsureSuperAdmin` (alias `super-admin`), `EnsureTwoFactorVerified`.
- **Events** (`app/Events`): `BookingCreated`, `BookingStatusChanged`, `FeedbackSubmitted`, `ScheduleUpdated` (broadcast ke channel `admin.bookings`).
- **Policies** (`app/Policies`): `BookingPolicy`, `FeedbackPolicy`, `ScheduleOverridePolicy`.
- **Rules** (`app/Rules`): `SafePublicUrl`, `VisitTime`.
- **Support** (`app/Support`): `PublicCache` (rememberCms + TTL/versi), `SiteContentDefaults`,
  `SeoMeta` (canonical URL, metadata, JSON-LD, sitemap, robots).
- **Console/Commands**: `ExpirePendingBookings` (`bookings:expire-pending`), `SyncIndonesianHolidays` (`holidays:sync-id`), `PruneAuditLogs` (`audit:prune`), `CleanupLunchBreakSlots`, `ResetUserTwoFactor`.

### 2.5 Routes (`routes/`)
- **api.php** — 3 grup: `public/*` (rate-limited; termasuk `open-event` + `open-registrations/*` throttle `public-open`), `auth/*` (login throttle + sanctum), `admin/*` (middleware `admin-access`, nested `super-admin` untuk users; termasuk `open-events*` & `open-events/{event}/registrations*`).
- **web.php** — `/robots.txt`, `/sitemap.xml`, `/info/alur-kunjungan` (OG tags WA preview)
  lalu catch-all `/{any?}` → `view('app')` (SPA dengan metadata/JSON-LD dan konten
  ringkasan server-rendered untuk crawler). Regex catch-all mengecualikan `api`.
- **channels.php** — private `admin.bookings` (gated `$user->isAdmin()`).
- **console.php** — jadwal: `audit:prune` 03:00, `bookings:expire-pending` tiap 5 menit, `holidays:sync-id` 02:30.

### 2.6 Database
- `database/migrations` (~41 file). Tabel inti: users, bookings, booking_sequences, booking_slots, booking_slot_locks, schedule_overrides, feedbacks, faqs, wa_templates, footer_contacts, site_settings, audit_logs, trusted_devices, national_holidays + tabel sistem (sessions, cache, jobs, personal_access_tokens).
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
- `realtime/echo.ts` — singleton Echo (Reverb/Pusher), lazy, state machine koneksi, gated `VITE_REVERB_ENABLED`. Channel: `admin.bookings` (private), `public.schedule`, `public.open` (Istura Open kuota live).
- `lib/`: `assets.ts`, `bookingDraft.ts` (autosave draft), `date.ts`, `legacyShims.ts`, `waActions.ts`, `whatsapp.ts`.
- `animations/`: `HomeAnimationLayer.tsx`, `useHomeAnimations.ts` (GSAP).

### 3.5 Components (`components/`)
- **admin/**: `AdminApp.tsx`, `AdminShell.tsx`, `AdminDashboard.tsx`, `AdminCmsManagers.tsx`, `AdminFeedbackList.tsx`, `AdminSystemPages.tsx`, `BookingScreen.tsx`, `ScheduleManager.tsx`, `IsturaOpenManager.tsx` (2 tab: Pengaturan & Hari + Pendaftar), `ExportModals.tsx`, `WeeklyPosterModal.tsx`, `TwoFactorChallenge.tsx`, `TwoFactorSetup.tsx`.
- **booking/**: `BookingWizard.tsx` (wizard 8 langkah). **feedback/**: `FeedbackScreen.tsx`. **home/**: `HomeScreen.tsx`. **open/**: `IsturaOpenWizard.tsx` (wizard publik Istura Open 5 langkah: pilih hari → data diri → add-on → tinjau → sukses + tombol grup WA; ada lookup/self-cancel via NIK), `IsturaOpenPromo.tsx` (popup sekali per event per pengunjung + banner persisten).
- **layout/**: `Navigation.tsx`, `Footer.tsx`, `FloatingContact.tsx` (FAB WhatsApp mengambang di halaman publik selain `booking`; expand jadi kartu MIKY + quick-topic prefill WA + tautan Instagram. Nomor dari `contacts`/CMS; sapaan & daftar topik dari `siteContent.floatingContact` (editable di admin Landing Page → "Widget WhatsApp Mengambang"), subtitle animasi typewriter). **ui/**: `DetailItem`, `LoadingStates`, `Pagination`, `StatCard`, `StatusBadge`. **icons/**: `SocialIcons.tsx`. `MikyGuide.tsx` (maskot).

### 3.6 Ekspor (browser, root `resources/js`)
- `exportBookings.ts`, `exportFeedback.ts`, `exportMonthlyReport.ts`, `exportWeeklyPoster.ts`, `exportShared.ts`, `exportOpenRegistrations.ts` (Istura Open → Excel `.xlsx` berstilir, per hari/seluruh event; ExcelJS lazy-import).

### 3.7 Build/config
- `package.json` scripts: `dev` (vite), `build` (vite build). `vite.config.js` (root). `tsconfig.json` alias `@/* → resources/js/*`.

> Catatan: ada dua file Echo — `resources/js/echo.js` (legacy global) dan `resources/js/realtime/echo.ts` (singleton typed). Gunakan `realtime/echo.ts` untuk kode baru.

---

## 4. Fitur Utama

Publik: landing CMS-driven, kalender jadwal 2 bulan, booking wizard 8 langkah (precheck identitas, autosave, split kloter otomatis), feedback pasca-kunjungan via token.
Admin: dashboard KPI realtime, manajemen booking (siklus hidup + segments + unduh surat + pesan WA tergenerasi), manajemen jadwal (slot/range override), feedback + ekspor, CMS penuh, 2FA, audit log, manajemen admin (super-admin), ekspor (Excel/PDF/ZIP, laporan bulanan, poster mingguan).
Roadmap: **Istura Open** sudah diimplementasi (modul terpisah — lihat `IsturaOpen.md` & §2.3). Pendaftaran perorangan per-event, kuota harian berbasis headcount, link grup WA, realtime kuota via channel `public.open`.

> Daftar lengkap requirement (FR/NFR/BR) ada di `PRD-ISTURA-APP.md` §2–§3.

---

## 5. Flow Aplikasi (ringkas)

### 5.1 Flow Publik
- **Lihat info & jadwal:** load `/api/public/bootstrap` → telusuri seksi → kalender slot (Available/Held/Booked/Closed) → "Mulai Booking".
- **Booking (8 langkah):** Selamat Datang → Contact Person (precheck NIK/WA) → Instansi → Pilih Jadwal → Upload Surat (≤5MB) → Review → Pernyataan → Selesai (kode `ISTURA-YYYY-NNNN`, status Pending). Submit mengunci slot via transaksi DB + broadcast realtime ke admin.
- **Feedback:** admin set Completed → kirim tautan WA (kode+token) → pengunjung isi rating dsb → submit sekali per booking.

### 5.2 Flow Admin
- **Login (+2FA):** email+password (progressive delay) → bila 2FA aktif tampil challenge TOTP/recovery + trusted device → dashboard (absolute session lifetime).
- **Booking lifecycle:** Pending → Accept/Reject/Reschedule; Accepted → Complete/Reschedule; Reschedule → Accept/Reject/Cancel; Expired → Reschedule/Reject. Tiap aksi: audit log + broadcast + invalidasi cache + pesan WA siap salin.
- **Jadwal:** tutup/buka slot tunggal atau rentang tanggal (override); default dihitung runtime; slot ber-booking aktif terlindungi.
- **CMS:** edit FAQ/ketentuan/kontak/hero/landing/template WA → simpan → bump cache publik.
- **Users (super-admin):** CRUD akun admin. **Dashboard/Feedback/Audit/Ekspor:** lihat KPI, feedback, audit dengan filter, ekspor data.

### 5.3 State booking
`Pending → Accepted → Completed` (+feedback); cabang `Rejected`, `Reschedule` (accept/cancel/reject), `Expired` (TTL/lewat jadwal). Detail diagram di `PRD-ISTURA-APP.md` §4.3–§4.4.

---

## 6. Verifikasi & Perintah

- Laravel test: `php artisan test` (atau filter relevan). Konfig di `phpunit.xml`, test di `tests/Feature` & `tests/Unit`.
- Frontend build: `npm run build`. Dev: `npm run dev` (Vite), `php artisan serve`, `php artisan reverb:start`.
- QA Playwright: skrip di `scripts/` (mis. `e2e-user-flow.mjs`) saat dev server hidup.

---

## 7. Catatan Keamanan (ringkas)
- NIK terenkripsi (`Crypt`), `nik_masked`/`nik_hash` untuk tampilan/dedup.
- Surat privat di `storage/app/private/booking-letters/`, akses via endpoint admin.
- Rate-limit endpoint publik; upload validasi mime + ≤5MB; security headers di semua respons; absolute session lifetime admin.
