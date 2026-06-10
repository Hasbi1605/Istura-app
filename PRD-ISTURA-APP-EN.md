# PRD — Project Requirements Document

**Product:** ISTURA Web — Visit Booking System for "Istana Untuk Rakyat" (Yogyakarta Presidential Palace)
**Document version:** 1.0
**Status:** Live (production-ready)
**App language:** Indonesian (UI); this document in English
**Last updated:** June 2026

---

## 1. Overview

### 1.1 Product Summary

ISTURA Web is a Laravel + React monolithic application that manages public visits to the
**Yogyakarta Presidential Palace (Gedung Agung)** through the "Istana Untuk Rakyat (ISTURA)"
program. The application serves two primary user groups:

1. **Public / Visitors (institutional groups, schools, communities, organizations)** —
   register a visit through an online booking form, upload a request letter, then wait for
   admin confirmation via WhatsApp. After the visit, visitors fill in feedback through a
   unique link.
2. **Admin & Super Admin (Gedung Agung Public Relations)** — manage booking requests, manage
   visit schedules/slots, monitor feedback, manage site content (CMS), manage admin
   accounts, and review activity history (audit log).

The application is a React Single Page Application (SPA) hosted on a single origin with a
Laravel backend. Data is stored in MySQL. The admin dashboard updates in real time via
WebSocket (Laravel Reverb).

### 1.2 Product Goals

- Replace the manual booking process (WhatsApp/phone) with a structured, documented flow.
- Prevent schedule conflicts and slot overbooking automatically.
- Give admins a centralized operational toolkit: approvals, reschedules, group-batch
  splitting, report exports, and public content management.
- Protect visitor personal data (encrypted NIK, private request letters).

### 1.3 Target Users

| Persona | Description | Key Needs |
|---------|-------------|-----------|
| Group contact person | Representative of an institution/school/community | Easy booking, clear schedule, fast confirmation |
| PR Admin | Daily operator | Manage bookings, schedule, feedback, content |
| Super Admin | System owner | All admin access + admin account management |

### 1.4 Key Terms (Glossary)

- **Booking / Request:** a single visit submission for a group.
- **Kloter / Segment:** the split of a large group across multiple time slots (80/slot capacity).
- **Slot:** a date + visit-time combination with a given status.
- **Schedule override:** a manual admin modification to a default slot (close/open/hold).
- **Feedback token:** a unique per-booking code that grants access to the post-visit feedback form.
- **Schedule horizon:** the calendar range shown to the public (today+2 days to +2 months).

---

## 2. Requirements

### 2.1 Functional Requirements — Public

| ID | Requirement |
|----|-------------|
| FR-P1 | Visitors can view a landing page with visit hours, requirements, booking steps, rules, sample letter, FAQ, and contacts. |
| FR-P2 | Visitors can view the slot availability calendar for the next 2 months without logging in. |
| FR-P3 | Visitors can submit a booking through a step-by-step wizard (8 steps) with per-step validation. |
| FR-P4 | The system performs an identity precheck (NIK/WhatsApp) before submit to prevent exceeding the active booking limit. |
| FR-P5 | Visitors must upload a request letter (PDF/JPG/JPEG/PNG, max 5 MB). |
| FR-P6 | Visitors receive a unique booking code (format ISTURA-YYYY-NNNN) after a successful submit. |
| FR-P7 | Visitors can fill in feedback after a booking reaches Completed status, via a unique token link. |
| FR-P8 | The booking form draft is auto-saved in the browser so it is not lost on refresh. |

### 2.2 Functional Requirements — Admin

| ID | Requirement |
|----|-------------|
| FR-A1 | Admins can log in with email + password; the system applies progressive delay on failed attempts. |
| FR-A2 | Admins can (optionally/mandatorily) enable Two-Factor Authentication (TOTP) with recovery codes & trusted devices. |
| FR-A3 | Admins can view a dashboard with KPIs (pending, bookings today/week/month, total completed, feedback count & average rating). |
| FR-A4 | Admins can view the booking list with status filter, date range, search, and pagination. |
| FR-A5 | Admins can accept, reject, reschedule, cancel a reschedule proposal, and mark complete a booking. |
| FR-A6 | Admins can change a booking's group-batch split (segments), including manual overbooking with a mandatory note. |
| FR-A7 | Admins can download a booking's request letter (inline preview or download). |
| FR-A8 | Admins can manage the schedule: close/open specific slots, and close/open date ranges. |
| FR-A9 | Admins can view & export feedback. |
| FR-A10 | Admins can manage CMS content: FAQ, terms/letter, footer contacts, hero & story, landing page, WhatsApp message templates. |
| FR-A11 | Admins can copy generated WhatsApp messages (per-status templates) to send to visitors. |
| FR-A12 | Admins can export booking data (Excel/PDF/ZIP), monthly reports, and the weekly poster. |
| FR-A13 | **Super Admins** can manage admin accounts (create, update, delete). |
| FR-A14 | Admins can view the activity history (audit log) with filters. |

### 2.3 Non-Functional Requirements

| ID | Category | Requirement |
|----|----------|-------------|
| NFR-1 | Security | NIK is stored encrypted (Laravel Crypt); only `nik_masked` & `nik_hash` are used for display/dedup. |
| NFR-2 | Security | Request letters are stored privately in `storage/app/private/booking-letters/`, accessed only via an authenticated admin endpoint. |
| NFR-3 | Security | Public endpoints are rate-limited (booking, feedback, schedule, login, 2FA). |
| NFR-4 | Security | Admin sessions have an absolute lifetime (default 720 minutes); auto-logout on expiry. |
| NFR-5 | Security | Security headers are added to all responses (AddSecurityHeaders middleware). |
| NFR-6 | Concurrency | Slot booking uses a DB transaction + a unique `active_slot_key` constraint to prevent overbooking. |
| NFR-7 | Realtime | Booking/schedule changes are broadcast via WebSocket; the admin dashboard auto-updates. Can be disabled via `VITE_REVERB_ENABLED=false` (graceful degradation). |
| NFR-8 | Localization | All UI text & dates are in Indonesian, timezone Asia/Jakarta. |
| NFR-9 | Accessibility | Interactive components must be accessibility-compliant (role, aria, focus trap on modals). |
| NFR-10 | Performance | Public data (schedule, CMS) is cached with a TTL & a cache version bumped on changes. |

### 2.4 Business Rules

| ID | Rule |
|----|------|
| BR-1 | The visit date is at the earliest **today+2 days** and at the latest **2 months** ahead. |
| BR-2 | Per time-slot (kloter) capacity = **80 people**. Groups > 80 are automatically split across consecutive slots. |
| BR-3 | Group size: minimum 1, maximum **480 people** per visit day. |
| BR-4 | NIK must be 16 numeric digits. WhatsApp must follow `08...` or `628...` (8–13 digits after prefix). |
| BR-5 | Default operating hours: **Monday–Thursday**, slots 08.00, 09.00, 10.00, 11.00, 13.00, 14.00. 12.00 = break (unavailable). |
| BR-6 | **Friday, Saturday, Sunday** and **national holidays** are automatically closed. |
| BR-7 | A single identity (NIK or WhatsApp) is limited to a number of concurrent active bookings (`PUBLIC_BOOKING_ACTIVE_IDENTITY_LIMIT`). |
| BR-8 | A Pending booking expires automatically when the visit time passes or it exceeds the TTL (default 48 hours, `PUBLIC_BOOKING_PENDING_TTL_HOURS`). |
| BR-9 | Feedback can only be submitted once per booking and only after the Completed status. |
| BR-10 | A booking cannot be marked Completed before the visit date. |

---

## 3. Core Features

### 3.1 Public Landing Page
An informative homepage containing: navigation, a hero with the virtual guide "MIKY", quick
info cards (hours, requirements, confirmation), schedule calendar, virtual tour video,
booking steps (4 steps), visit activities, rules & code of conduct, sample request letter,
FAQ, CTA, and a footer with contacts & a location map. All content is managed via the admin
CMS.

### 3.2 Booking Wizard (8 Steps)
A step-by-step registration form with the MIKY guide at each step:
1. **Welcome** — data preparation.
2. **Contact Person Data** — name, NIK, WhatsApp.
3. **Institution Data** — institution name, group size.
4. **Pick Schedule** — date & time from available slots (live status).
5. **Upload Letter** — request letter (PDF/JPG/PNG, ≤5 MB).
6. **Review Data** — verify all entries.
7. **Statement** — agreement on data accuracy & rules.
8. **Done** — booking code + Pending status.

Supporting features: identity precheck on continue, draft autosave, automatic group-batch
split for large groups.

### 3.3 Booking Management (Admin)
A booking table with filters (status, date range, sort), search (code/name/institution),
view mode (split/table), and lifecycle actions: accept, reject, reschedule, cancel
reschedule, complete, change segments, download letter. Each action produces a ready-to-copy
generated WhatsApp message & an audit log entry.

### 3.4 Schedule Management (Admin)
A calendar grid with per-slot status (Available, Held, Booked, Closed, Reschedule Hold).
Admins can close/open a single slot or a date range (e.g., closing an event week). Default
status is computed at runtime; only overrides are stored. Integrates automatic national
holiday sync from an external provider.

### 3.5 Visit Feedback
After a booking is Completed, the visitor receives a unique feedback link (token). The form
rates: overall rating, booking ease, service, recommendation (1–5 scale), highlights,
improvement areas, comment, and publish consent. Admins view & export feedback.

### 3.6 CMS (Content Management)
Admins manage all public content without deploying: FAQ, visit terms/letter, footer
contacts, hero & story, landing page (sections), and per-status WhatsApp message templates
(Pending, Accepted, Rejected, Reschedule, Completed, Expired).

### 3.7 Admin Authentication & Security
Email+password login (Sanctum SPA session), anti-bruteforce progressive delay, Two-Factor
Authentication TOTP with recovery codes & trusted devices, absolute session lifetime,
super_admin/admin roles.

### 3.8 Dashboard & Reporting
Concise KPIs, today's bookings, latest feedback. Exports: booking data (Excel/PDF/ZIP),
monthly report, weekly schedule poster. Realtime update via WebSocket.

### 3.9 Audit Log
Automatic recording of all important actions (new booking, status changes, feedback, etc.)
with actor, target, payload, and request context. Retention is pruned automatically (default
180 days).

### 3.10 (Roadmap) Istura Open
A planned module for individual registration based on daily quota (events such as
independence week), separate from group booking. Not implemented in this version — see the
`IsturaOpen.md` document.

---

## 4. User Flow

### 4.1 User Flow — Public (Visitor)

#### 4.1.1 Flow: View Information & Schedule
```
1. Visitor opens the app (home page).
2. The system loads the public bootstrap (schedule, FAQs, contacts, WA templates, hero, letter, site content).
3. Visitor browses sections: quick info → schedule → video → booking steps → activities
   → rules → sample letter → FAQ → CTA → footer.
4. In the schedule section, the visitor sees the calendar for the next 2 months:
   - Available slot (gold) = selectable.
   - Gray slot = taken (Held/Booked) / closed (Closed) / out of range.
   - National holidays & weekends are marked closed with a reason.
5. Visitor clicks "Mulai Booking" (Start Booking) → enters the Booking Wizard.
```

#### 4.1.2 Flow: Booking Submission (Happy Path)
```
1. Visitor clicks "Start Booking" from the navigation/CTA.
2. Step 1 (Welcome): reads the prep notes → clicks Next.
3. Step 2 (Contact Person): enters Name, NIK (16 digits), WhatsApp (08../628..) → Next.
   → System prechecks identity: if the active booking limit is reached → show error,
     cannot continue.
4. Step 3 (Institution): enters Institution Name, Group Size (1–480) → Next.
5. Step 4 (Pick Schedule): pick Date (today+2 days to +2 months) & Time from Available slots.
   → If the group > 80, the system prepares an automatic batch split across consecutive slots.
6. Step 5 (Upload Letter): upload PDF/JPG/JPEG/PNG file ≤ 5 MB → Next.
7. Step 6 (Review): verify all data → Next.
8. Step 7 (Statement): check the agreement → click Submit Request.
9. The system re-validates, locks the slot (DB transaction), saves the booking as Pending,
   stores the letter privately, and records an audit log + realtime broadcast to admin.
10. Step 8 (Done): show the booking code (ISTURA-YYYY-NNNN) + the "admin will contact within
    1x24 hours via WhatsApp" message.
```

#### 4.1.3 Flow: Booking — Alternative / Error Scenarios
```
- Slot taken by another user at submit → "slot unavailable" error, user picks another slot.
- NIK/WhatsApp exceeds the active booking limit → error at the Contact Person step.
- Letter file > 5 MB or wrong format → upload validation error.
- Date < today+2 days or > 2 months → date validation error.
- 12.00 time selected → rejected (break time).
- Browser refresh mid-wizard → draft is auto-restored (autosave).
```

#### 4.1.4 Flow: Submit Post-Visit Feedback
```
1. Admin marks the booking Completed → copies the WA message containing the unique feedback link.
2. Visitor receives the WA message → opens the feedback link (contains code + token).
3. The system validates code + token + Completed status.
   → Wrong token / not yet Completed / feedback already exists → show error.
4. Visitor fills in: rating, booking ease, service, recommendation (1–5), highlights,
   improvement areas, comment, publish consent.
5. Visitor submits → the system stores the feedback (once per booking) + audit log.
6. Show a thank-you confirmation.
```

### 4.2 Admin Flow

#### 4.2.1 Flow: Admin Login (+ 2FA)
```
1. Admin opens the app → admin mode → login form.
2. Admin enters email + password → submit.
   → Wrong credentials → error; after 3 failures → progressive delay (2^n seconds, max 5 minutes).
   → Inactive account (unverified email) → rejected.
3. Login success:
   → If 2FA is enabled & the session is not verified → response requires_2fa=true → show the
     Two-Factor Challenge.
        a. Admin enters the TOTP code (or a recovery code).
        b. "Trust this device" option → trusted device is stored.
   → If 2FA is not enabled → go straight to the dashboard.
4. The admin session starts (absolute lifetime 720 minutes). On expiry → auto-logout.
```

#### 4.2.2 Flow: Set Up Two-Factor Authentication
```
1. Admin opens 2FA settings → clicks Setup.
2. The system generates a secret + QR code → admin scans it with an authenticator app.
3. Admin enters the confirmation code → 2FA confirmed.
4. The system shows recovery codes (once) → admin saves them.
5. Optional: regenerate recovery codes, disable 2FA (with verification).
```

#### 4.2.3 Flow: Manage Bookings (Lifecycle)
```
1. Admin opens the Booking menu → the booking table loads (status/date filters, search, pagination).
2. Admin selects a booking → views details (data, segments, letter).
3. Available actions depend on status:
   - Pending  → Accept | Reject | Reschedule
   - Accepted → Complete | Reschedule
   - Reschedule → Accept (confirm proposal) | Reject | Reschedule | Cancel Reschedule
   - Expired  → Reschedule | Reject
4. ACCEPT: validates the schedule has not passed → Accepted status → copy "approved" WA message.
5. REJECT: Rejected status → copy "rejected" WA message (reason note).
6. RESCHEDULE: admin picks a new proposed date+time → Reschedule status (original slot stays
   held, the new proposal is prepared) → copy "reschedule proposal" WA message.
7. CANCEL RESCHEDULE: revert to the previous status (Accepted/Pending) → copy WA message.
8. COMPLETE: only when the visit date ≤ today → Completed status → copy WA message with the
   feedback link.
9. CHANGE SEGMENTS: admin restructures the participant split across slots; total participants
   must match; overbooking/merging large batches/changing the count → mandatory note.
10. DOWNLOAD LETTER: admin previews inline or downloads the request letter.
11. Every action is recorded in the audit log & triggers a realtime broadcast + schedule cache
    invalidation.
```

#### 4.2.4 Flow: Manage the Schedule
```
1. Admin opens the Visit Schedule menu → the calendar grid with slot statuses.
2. Close/open a single SLOT: pick date+time → set status (Closed/Available/Held) + note.
3. Close/open a date RANGE: pick the range → set status (e.g., Closed for an event) + note.
4. Remove a slot override → reverts to the default computation.
5. Slots that already have an active booking cannot be closed arbitrarily (protected).
6. Changes trigger a ScheduleUpdated broadcast & public cache invalidation.
```

#### 4.2.5 Flow: Manage Content (CMS)
```
1. Admin opens the "Web Content" menu group.
2. Picks a sub-menu: FAQ | Visit Terms | Footer Contacts | Hero & Story | Landing Page
   | WA Message Templates.
3. Edits content in the editor → saves.
4. The system saves to site_settings/related tables, records an audit log, and bumps the
   public cache so changes appear on the landing page immediately.
```

#### 4.2.6 Flow: Manage Admin Users (Super Admin only)
```
1. Super Admin opens the Admin Users menu (not visible to regular admins).
2. Views the admin list → Create / Update / Delete an account.
   - Create: name, email, password, role (admin/super_admin), phone.
   - Delete/update is subject to rules (e.g., cannot improperly deactivate oneself).
3. Changes are recorded in the audit log.
```

#### 4.2.7 Flow: Dashboard, Feedback & Audit
```
- Dashboard: admin views KPIs, today's bookings, latest feedback — auto-refresh in realtime.
- Feedback: admin views the feedback list, details, and exports.
- Audit: admin views the activity history with filters (actor, action, date).
- Exports: bookings (Excel/PDF/ZIP), monthly report, weekly poster.
```

### 4.3 State Diagram — Booking Status
```
            ┌──────────┐  accept   ┌──────────┐  complete  ┌───────────┐
  submit →  │ Pending  │ ───────→  │ Accepted │ ─────────→ │ Completed │ → feedback
            └────┬─────┘           └────┬─────┘            └───────────┘
                 │ reject              │ reschedule
                 ▼                     ▼
            ┌──────────┐         ┌──────────────┐ accept → Accepted
            │ Rejected │         │  Reschedule  │ cancel → (previous status)
            └──────────┘         └──────┬───────┘ reject → Rejected
                 ▲                      │ (proposal passed)
   (TTL/passed)  │                      ▼
            ┌──────────┐          (Expired / restored status)
  Pending → │ Expired  │ → reschedule | reject
            └──────────┘
```

### 4.4 State — Schedule Slot Status
```
Available      → open slot, bookable by the public
Held           → slot held by a Pending booking
Booked         → slot filled by an Accepted booking
Reschedule Hold→ slot held by a reschedule proposal
Closed         → slot closed (weekend/holiday default, or admin override)
```

---

## 5. Architecture

### 5.1 Tech Stack

| Layer | Technology |
|-------|------------|
| Backend | Laravel 13 (PHP 8.4) |
| Database | MySQL (utf8mb4_unicode_ci) |
| Authentication | Laravel Sanctum (SPA cookie session) |
| Realtime | Laravel Reverb (WebSocket) + laravel-echo / pusher-js |
| Frontend | React 19 + TypeScript + Vite |
| Animation / UI | GSAP, lucide-react |
| Export (browser) | pdfmake (PDF), exceljs (XLSX), jszip (ZIP) |
| Cache / Queue | database driver (cache, queue, session) |
| File storage | local disk (`storage/app/private`) |

### 5.2 Architecture Patterns

- **Single-origin monolith:** Laravel hosts the React SPA (`resources/views/app.blade.php`)
  and serves the REST API + WebSocket. All non-API routes (`/{any}`) are handed to a
  state-based React router.
- **Thin controllers + Services:** domain logic is centralized in `app/Services`
  (`BookingService`, `ScheduleService`, `TwoFactorService`, `NationalHolidaySyncService`,
  `BookingCodeGenerator`, `AuditLogger`). Controllers only orchestrate.
- **FormRequest validation:** per-action validation in `app/Http/Requests`.
- **API Resources:** camelCase JSON shapes (mirroring React types) in `app/Http/Resources`.
- **Events & Broadcasting:** `BookingCreated`, `BookingStatusChanged`, `FeedbackSubmitted`,
  `ScheduleUpdated` are broadcast via Reverb.
- **Public caching:** `PublicCache` remembers schedule & CMS content with a TTL + a cache
  version bumped when data changes.

### 5.3 API Structure (Summary)

**Public** (`/api/public`, with per-group rate-limit)
```
GET  /bootstrap                  # initial bundle: schedule, faqs, contacts, waTemplates, hero, letter, siteContent
GET  /faqs | /contacts | /schedule | /hero | /letter | /site-content
GET  /wa-templates | /wa-templates/{status}
POST /bookings/precheck          # identity check (throttle:public-bookings)
POST /bookings                   # submit booking (throttle:public-bookings)
GET  /feedback/{code}            # fetch feedback by code+token (throttle:public-feedback)
POST /feedback/{code}            # submit feedback (throttle:public-feedback)
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

**Admin** (`/api/admin`, `admin-access` middleware)
```
GET  /dashboard
GET  /bookings | /bookings/{code}
POST /bookings/{code}/{accept,reject,reschedule,reschedule/cancel,segments,complete}
GET  /bookings/{code}/document
GET  /schedule ; POST /schedule/slot ; DELETE /schedule/slot ; POST /schedule/range
GET  /feedback | /feedback/{code}
GET/PUT/POST /cms/{faqs,contacts,wa-templates,hero,letter,site-content}
GET  /audit-logs
# Super Admin only (super-admin middleware):
GET/POST/PUT/DELETE /users
```

**Realtime Channels** (`routes/channels.php`)
```
private-admin.bookings           # admin users only (booking & schedule broadcasts)
```

### 5.4 Security Middleware

| Middleware | Function |
|------------|----------|
| `admin-access` | Ensures the user is authenticated & has the admin/super_admin role |
| `super-admin` | Restricts user-management endpoints to super admins |
| `EnsureAdminSessionFresh` | Enforces the admin absolute session lifetime |
| `EnsureTwoFactorVerified` | Ensures the session has passed 2FA when enabled |
| `AddSecurityHeaders` | Adds security headers to all responses |

### 5.5 Scheduled Jobs (Console Commands)

| Command | Function |
|---------|----------|
| `ExpirePendingBookings` | Marks Pending bookings past their schedule/TTL as Expired |
| `SyncIndonesianHolidays` | Syncs national holidays from the provider |
| `PruneAuditLogs` | Prunes audit logs older than the retention (default 180 days) |
| `CleanupLunchBreakSlots` | Cleans up lunch-break slots |
| `ResetUserTwoFactor` | Resets a user's 2FA (operational/recovery) |

---

## 6. Database Schema

### 6.1 `users`
| Column | Type | Notes |
|--------|------|-------|
| id | bigint PK | |
| name | string | |
| email | string unique | |
| role | string (index) | `admin` \| `super_admin` (default admin) |
| phone | string nullable | |
| email_verified_at | timestamp nullable | null = inactive account |
| password | string (hashed) | |
| two_factor_secret | text nullable | |
| two_factor_recovery_codes | text nullable | |
| two_factor_confirmed_at | timestamp nullable | |
| last_login_at | timestamp nullable | |
| remember_token | string | |
| timestamps | | |

### 6.2 `bookings`
| Column | Type | Notes |
|--------|------|-------|
| id | bigint PK | |
| code | string unique | ISTURA-YYYY-NNNN |
| contact_name | string | |
| nik_encrypted | text | Crypt-encrypted NIK |
| nik_masked | string(32) | display |
| nik_hash | string (index) | identity dedup |
| whatsapp | string(32) | |
| whatsapp_normalized | string (index) | identity dedup |
| institution | string | |
| group_size | smallint | group size |
| date | date | visit date |
| date_label | string | "Jumat, 29 Mei 2026" |
| time | string(5) | "09.00" |
| status | enum | Pending, Accepted, Rejected, Reschedule, Completed, Expired |
| document_path | string nullable | private letter path |
| document_original_name | string | original letter name |
| feedback_token | string(64) unique | feedback token |
| submitted_at | timestamp | |
| completed_at | timestamp nullable | |
| rejected_at | timestamp nullable | |
| expired_at | timestamp nullable | |
| note | text nullable | admin note |
| proposed_date / proposed_date_label / proposed_time | nullable | reschedule proposal |
| proposed_segments | json nullable | proposed batch split |
| proposed_at | timestamp nullable | |
| reschedule_previous_status | string nullable | status before reschedule |
| timestamps | | |

Indexes: `status`, `(date,time)`, `(date,status)`.

### 6.3 `booking_slots`
| Column | Type | Notes |
|--------|------|-------|
| id | bigint PK | |
| booking_id | FK → bookings (cascade) | |
| slot_order | smallint | batch order |
| date | date | |
| date_label | string | |
| time | string(5) | |
| group_size | smallint | participants in this slot (≤80) |
| kind | string | normal \| proposed (reschedule) |
| active_slot_key | string(16) unique nullable | `date|time`, unique = anti-overbook |
| timestamps | | |

Unique: `(booking_id, slot_order)`, `active_slot_key`. Index: `(date,time)`.

### 6.4 `schedule_overrides`
| Column | Type | Notes |
|--------|------|-------|
| id | bigint PK | |
| date | date | |
| time | string(5) | |
| status | enum | Available, Held, Booked, Closed, Reschedule Hold |
| custom | bool | slot outside the default |
| note | string nullable | |
| timestamps | | |

Unique: `(date, time)`. Index: `date`. Only modified slots are stored; defaults are computed
at runtime.

### 6.5 `feedbacks`
| Column | Type | Notes |
|--------|------|-------|
| id | bigint PK | |
| booking_id | FK → bookings nullable (unique) | |
| code | string (index) | denormalized for export |
| rating / booking_ease / service / recommend | tinyint | 1–5 scale |
| highlights | json | positive aspects |
| improvements | json | improvement areas |
| comment | text nullable | |
| allow_publish | bool | publish consent |
| submitted_at | timestamp nullable | |
| timestamps | | |

### 6.6 `national_holidays`
| Column | Type | Notes |
|--------|------|-------|
| id | bigint PK | |
| date | date unique | |
| year | smallint (index) | |
| name | string | |
| type | string(32) | national holiday / collective leave |
| tentative | bool | |
| source / source_url | string | provider |
| provider_updated_at / synced_at | timestamp nullable | |
| checksum | string(64) | change detection |
| timestamps | | |

### 6.7 `faqs`
| Column | Type | Notes |
|--------|------|-------|
| id | bigint PK | |
| slug | string unique | |
| question | string | |
| answer | text | |
| category | string nullable | |
| sort_order | int | |
| (link fields) | | optional link label/href |
| timestamps | | |

### 6.8 `wa_templates`
| Column | Type | Notes |
|--------|------|-------|
| id | bigint PK | |
| status_key | enum unique | Pending, Accepted, Rejected, Reschedule, Completed, Expired |
| label | string | |
| description | string | |
| template | text | placeholders `{nama}`, `{instansi}`, `{tanggal}`, `{jam}`, `{kode}`, `{link}`, etc. |
| updated_by | FK → users nullable | |
| timestamps | | |

### 6.9 `footer_contacts`
| Column | Type | Notes |
|--------|------|-------|
| id | bigint PK | |
| slug | string unique | |
| label / value | string | |
| icon | enum | instagram, youtube, whatsapp, email, phone |
| href | string nullable | |
| sort_order | int | |
| timestamps | | |

### 6.10 `site_settings`
| Column | Type | Notes |
|--------|------|-------|
| id | bigint PK | |
| key | string unique | "hero", "letter", "site_content" |
| value | json | |
| timestamps | | |

### 6.11 `audit_logs`
| Column | Type | Notes |
|--------|------|-------|
| id | bigint PK | |
| actor_id | FK → users nullable | null = system/public |
| actor_name | string nullable | |
| action | string | action description |
| target_type / target_id | string nullable | related object |
| payload | json nullable | details + request context |
| created_at | timestamp | |

### 6.12 `trusted_devices`
| Column | Type | Notes |
|--------|------|-------|
| id | bigint PK | |
| user_id | FK → users (cascade) | |
| device_hash | string(64) (index) | |
| device_name | string nullable | |
| trusted_until | timestamp | 2FA trust validity |
| timestamps | | |

Unique: `(user_id, device_hash)`.

### 6.13 `booking_sequences`
| Column | Type | Notes |
|--------|------|-------|
| id | bigint PK | |
| year | smallint unique | |
| next_sequence | int | per-year booking code counter (locked) |
| timestamps | | |

### 6.14 System Tables
`sessions`, `password_reset_tokens`, `personal_access_tokens` (Sanctum), `cache`,
`jobs`/`job_batches`/`failed_jobs` (database queue).

### 6.15 Key Relationships
```
users 1───* audit_logs (actor)
users 1───* trusted_devices
users 1───* wa_templates (updated_by)
bookings 1───* booking_slots
bookings 1───1 feedbacks
bookings *───* schedule (via date/time, computed by ScheduleService)
```

---

## 7. Design & Technical Constraints

### 7.1 Functional Constraints
- **Booking range:** today+2 days to +2 months; outside that range it cannot be booked.
- **Slot capacity:** 80 people per batch; large groups are split across consecutive slots
  (max total 480/day).
- **Service hours:** Monday–Thursday (08.00–11.00 & 13.00–14.00 WIB); 12.00 break;
  Friday–Sunday & national holidays closed.
- **Anti-overbooking:** guaranteed at the DB level via a unique `active_slot_key` + a
  `lockForUpdate` transaction.
- **Identity limit:** one NIK/WhatsApp is limited to concurrent active bookings (env config).
- **Auto-expiry:** Pending past schedule or TTL (48 hours default) → Expired via a job.

### 7.2 Security & Privacy Constraints
- NIK is never stored/sent as plaintext to the client (only masked/hash).
- Request letters are private; there is no public URL; only admins via an authenticated endpoint.
- Rate limiting on all public & auth endpoints (booking, feedback, schedule, login, 2FA).
- Login progressive delay (exponential, capped at 5 minutes) after 3 failures.
- Admin absolute session lifetime (default 720 minutes) + optional TOTP 2FA.
- Security headers + CORS restricted to registered origins (`SANCTUM_STATEFUL_DOMAINS`,
  `CORS_ALLOWED_ORIGINS`).
- Uploads validated by MIME + size ≤ 5 MB.

### 7.3 Technical Constraints
- **Single origin:** frontend & backend on one domain; state-based SPA router (not server
  paths). All non-API routes fall through to the React shell.
- **Fixed timezone Asia/Jakarta**, locale `id`.
- **Optional realtime:** `VITE_REVERB_ENABLED=false` disables WebSocket; the app still runs
  with manual refetch (graceful degradation).
- **Browser-side exports:** PDF/XLSX/ZIP are generated on the client (pdfmake, exceljs,
  jszip), not on the server.
- **Versioned public cache:** the cache version is bumped on data changes; admin changes
  appear immediately.
- **Dev runtime dependencies:** requires 3 parallel processes (Laravel serve, Vite, Reverb).
- **Database:** MySQL; local development sometimes on port 3307 (adjust `.env`).

### 7.4 UI/UX Design Constraints
- Palace visual identity: gold/elegant tones, the virtual guide **MIKY** guides the wizard.
- Step-by-step booking wizard with contextual helpers & draft autosave.
- Slot statuses distinguished by color (gold = available, gray = unavailable) with explicit
  closure reasons (national holiday, weekend, closed by admin).
- Modals/overlays must be accessible: `role="dialog"`, `aria-modal`, focus trap, ESC closes,
  body scroll locked.
- All text in Indonesian; long local date format ("Jumat, 29 Mei 2026").

### 7.5 Assumptions & Dependencies
- An external national holidays provider is available for schedule holiday auto-sync.
- Visitor confirmation is done **manually via WhatsApp** (admin copies the generated
  message); there is no automatic WhatsApp API integration.
- The initial admin account is created via a seeder (`SEED_ADMIN_PASSWORD`), then the
  password is rotated.

### 7.6 Out of Scope (This Version)
- Individual registration based on daily quota (the **Istura Open** module — still roadmap).
- Automatic WhatsApp message sending / WA API integration.
- Payments (the visit is free).
- On-site check-in / scanning.
- Visitor identity verification / OTP.

---

## 8. Acceptance Criteria

Format: Given / When / Then. These criteria are written to drive functional test generation.

### 8.1 Public — Schedule & Landing

**AC-P1.1 — Schedule visible without login**
- Given a visitor who is not logged in
- When they open the home page and scroll to the schedule section
- Then the calendar for the next 2 months is displayed with each slot's status (available/taken/closed)

**AC-P1.2 — Weekends & holidays closed**
- Given the schedule calendar
- When the visitor views a Friday, Saturday, Sunday, or a national holiday
- Then the day is shown as closed with a closure reason and its slots are not selectable

**AC-P1.3 — Out-of-range dates not bookable**
- Given today's date
- When the visitor views dates before today+2 days or after +2 months
- Then those dates are not offered as bookable options

### 8.2 Public — Booking Wizard

**AC-P2.1 — Successful booking creates a Pending record**
- Given a visitor with valid data and an available slot
- When they complete all 8 wizard steps and submit
- Then a booking is created with Pending status and a unique code (ISTURA-YYYY-NNNN) is shown

**AC-P2.2 — NIK validation**
- Given the Contact Person step
- When the visitor enters a NIK that is not exactly 16 numeric digits
- Then a validation error "NIK harus 16 digit angka" is shown and they cannot continue

**AC-P2.3 — WhatsApp validation**
- Given the Contact Person step
- When the visitor enters a WhatsApp number not matching `08...` or `628...` (8–13 digits)
- Then a WhatsApp format validation error is shown

**AC-P2.4 — Identity active-booking limit**
- Given a NIK/WhatsApp that already has the maximum active bookings
- When the visitor proceeds past the Contact Person step (precheck)
- Then an error states the active booking limit is reached and they cannot continue

**AC-P2.5 — Group size bounds**
- Given the Institution step
- When the visitor enters a group size < 1 or > 480
- Then a validation error is shown

**AC-P2.6 — Large group auto-split**
- Given a group size greater than 80
- When the visitor picks a start time
- Then the system splits the group across consecutive slots automatically (multiple segments)

**AC-P2.7 — Letter upload constraints**
- Given the Upload Letter step
- When the visitor uploads a file that is not PDF/JPG/JPEG/PNG or larger than 5 MB
- Then an upload validation error is shown and the file is rejected

**AC-P2.8 — Break time not selectable**
- Given the Pick Schedule step
- When the visitor tries to select the 12.00 time
- Then it is rejected as the break time

**AC-P2.9 — Agreement required**
- Given the Statement step
- When the visitor submits without checking the agreement
- Then a "Persetujuan wajib dicentang" error is shown and submission is blocked

**AC-P2.10 — Slot conflict at submit (concurrency)**
- Given two visitors selecting the last capacity of the same slot
- When both submit nearly simultaneously
- Then only one succeeds and the other receives a "slot unavailable" error (no overbooking)

**AC-P2.11 — Draft autosave**
- Given a visitor partway through the wizard
- When the browser is refreshed
- Then the previously entered data is restored from the autosaved draft

### 8.3 Public — Feedback

**AC-P3.1 — Feedback only after Completed**
- Given a booking that is not yet Completed
- When the visitor opens the feedback link
- Then feedback submission is blocked with an appropriate message

**AC-P3.2 — Valid token required**
- Given a feedback link with an invalid or missing token
- When the visitor opens it
- Then a "Kode atau token feedback tidak valid" error is returned

**AC-P3.3 — Submit feedback once**
- Given a Completed booking with a valid feedback token and no existing feedback
- When the visitor submits ratings (1–5) and content
- Then the feedback is saved and a thank-you confirmation is shown

**AC-P3.4 — No duplicate feedback**
- Given a booking that already has feedback
- When the visitor submits again
- Then a "Feedback untuk kode ini sudah pernah dikirim" error is returned

### 8.4 Admin — Authentication

**AC-A1.1 — Login success**
- Given an active admin with correct credentials
- When they submit the login form (and 2FA is not enabled)
- Then they are authenticated and reach the dashboard

**AC-A1.2 — Wrong credentials**
- Given an admin entering an incorrect email/password
- When they submit
- Then an "Email atau password salah" error is shown

**AC-A1.3 — Progressive delay**
- Given 3 consecutive failed login attempts for the same IP+email
- When a further attempt is made
- Then the request is delayed/locked with a remaining-seconds message (exponential, max 5 minutes)

**AC-A1.4 — Inactive account blocked**
- Given an account with no verified email (inactive)
- When it logs in with correct credentials
- Then login is rejected with an "akun nonaktif" message

**AC-A1.5 — 2FA challenge**
- Given an admin with 2FA enabled and an unverified session
- When they log in successfully
- Then the response requires 2FA and a Two-Factor Challenge is shown before dashboard access

**AC-A1.6 — Absolute session expiry**
- Given an admin session older than the absolute lifetime (default 720 minutes)
- When the next authenticated request is made
- Then the session is invalidated and the admin is logged out

### 8.5 Admin — Booking Lifecycle

**AC-A2.1 — Accept a Pending booking**
- Given a Pending booking whose visit time has not passed
- When the admin clicks Accept
- Then the status becomes Accepted and an "approved" WA message becomes available to copy

**AC-A2.2 — Cannot accept a passed visit**
- Given a Pending booking whose visit time has already passed
- When the admin attempts to Accept
- Then the action is rejected with a "jadwal sudah terlewat" message

**AC-A2.3 — Reject a booking**
- Given a Pending/Reschedule/Expired booking
- When the admin clicks Reject
- Then the status becomes Rejected and a "rejected" WA message becomes available

**AC-A2.4 — Reschedule proposal**
- Given an active booking
- When the admin proposes a new date+time
- Then the status becomes Reschedule, the original slot stays held, and a "reschedule proposal" WA message is available

**AC-A2.5 — Confirm reschedule**
- Given a Reschedule booking with a valid proposal
- When the admin Accepts the proposal
- Then the booking moves to the proposed slot and becomes Accepted

**AC-A2.6 — Cancel reschedule**
- Given a Reschedule booking
- When the admin cancels the proposal
- Then the booking reverts to its previous status (Accepted/Pending) and the proposed slot is released

**AC-A2.7 — Complete only on/after the visit date**
- Given an Accepted booking with a visit date in the future
- When the admin tries to mark it Completed
- Then the action is rejected; when the date is today or earlier, completion succeeds

**AC-A2.8 — Segment change requires matching total**
- Given a booking
- When the admin restructures segments where the sum of participants differs from the group size
- Then a validation error is shown and the change is blocked

**AC-A2.9 — Overbook requires a note**
- Given a segment change that overbooks, merges large batches, or changes the count
- When the admin saves without a note
- Then a "Catatan wajib" error is shown

**AC-A2.10 — Download letter**
- Given a booking with an uploaded letter
- When the admin requests the document
- Then the private letter is returned (inline preview or download) only to an authenticated admin

**AC-A2.11 — Invalid transition blocked**
- Given a booking in a given status
- When the admin attempts a transition not allowed for that status
- Then the action is rejected with a "status tidak dapat diubah" message

### 8.6 Admin — Schedule

**AC-A3.1 — Close a slot**
- Given the schedule manager
- When the admin sets a single date+time slot to Closed
- Then that slot becomes unavailable for public booking and a closure reason is recorded

**AC-A3.2 — Close a date range**
- Given the schedule manager
- When the admin closes a date range
- Then all affected dates become closed for public booking

**AC-A3.3 — Schedule change broadcasts**
- Given a connected admin dashboard (realtime enabled)
- When the schedule is changed
- Then the public schedule cache is invalidated and a ScheduleUpdated event is broadcast

### 8.7 Admin — Users (Super Admin only)

**AC-A4.1 — User menu restricted**
- Given a regular admin (not super admin)
- When they view the menu and attempt the users endpoints
- Then the Admin Users menu is not available and the API rejects access

**AC-A4.2 — Manage admin accounts**
- Given a super admin
- When they create/update/delete an admin account with valid data
- Then the change is applied and recorded in the audit log

### 8.8 Admin — Dashboard, Feedback, Audit, Export

**AC-A5.1 — Dashboard KPIs**
- Given existing bookings & feedback
- When the admin opens the dashboard
- Then KPIs (pending, today/week/month bookings, total completed, feedback count & average rating) are displayed

**AC-A5.2 — Realtime dashboard update**
- Given an open admin dashboard with realtime enabled
- When a new public booking is created
- Then the dashboard reflects the new booking without a manual reload

**AC-A5.3 — Audit logging**
- Given any important action (new booking, status change, feedback, content update)
- When the action completes
- Then an audit log entry is recorded with actor, action, target, and request context

**AC-A5.4 — Export bookings**
- Given the booking list
- When the admin triggers an export (Excel/PDF/ZIP)
- Then a file is generated client-side containing the filtered booking data

### 8.9 CMS

**AC-A6.1 — Content updates appear immediately**
- Given an admin editing CMS content (FAQ/contacts/hero/letter/landing/WA template)
- When they save
- Then the public cache is bumped and the change is reflected on the landing page

---

## Appendix A — Endpoint Summary for Test Scenarios

| User Action | Endpoint | Method | Auth |
|-------------|----------|--------|------|
| Load initial public data | `/api/public/bootstrap` | GET | Public |
| View schedule | `/api/public/schedule` | GET | Public |
| Booking precheck | `/api/public/bookings/precheck` | POST | Public |
| Submit booking | `/api/public/bookings` | POST | Public |
| View feedback | `/api/public/feedback/{code}` | GET | Token |
| Submit feedback | `/api/public/feedback/{code}` | POST | Token |
| Admin login | `/api/auth/login` | POST | Public |
| Verify 2FA | `/api/auth/two-factor/verify` | POST | Session |
| Admin dashboard | `/api/admin/dashboard` | GET | Admin |
| Booking list | `/api/admin/bookings` | GET | Admin |
| Accept booking | `/api/admin/bookings/{code}/accept` | POST | Admin |
| Reject booking | `/api/admin/bookings/{code}/reject` | POST | Admin |
| Reschedule booking | `/api/admin/bookings/{code}/reschedule` | POST | Admin |
| Complete booking | `/api/admin/bookings/{code}/complete` | POST | Admin |
| Close schedule range | `/api/admin/schedule/range` | POST | Admin |
| Manage users | `/api/admin/users` | GET/POST/PUT/DELETE | Super Admin |

## Appendix B — Accounts & Roles

| Role | Access |
|------|--------|
| Visitor (public) | Landing page, schedule, booking, feedback |
| Admin | All operational features & CMS, except user management |
| Super Admin | All Admin access + admin account management |
