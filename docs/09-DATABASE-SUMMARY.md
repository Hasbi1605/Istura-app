# Database Summary

Ringkasan ini bukan pengganti migration. Untuk detail pasti, baca `database/migrations/`.

## Tabel Inti

- `users`: akun admin/viewer/super admin, 2FA, password, verification.
- `bookings`: permohonan booking rombongan, identitas terenkripsi, jadwal utama, status,
  token feedback, file surat, catatan, data reschedule.
- `booking_slots`: pembagian kloter aktif/proposed per booking.
- `booking_slot_locks`: lock tambahan untuk sinkronisasi slot.
- `booking_sequences`: counter kode `ISTURA-YYYY-NNNN`.
- `schedule_overrides`: override slot jadwal; default dihitung runtime.
- `feedbacks`: feedback rombongan, relasi 1:N dari booking.
- `faqs`, `wa_templates`, `footer_contacts`, `site_settings`: konten CMS.
- `audit_logs`: riwayat aksi.
- `trusted_devices`: perangkat yang dipercaya untuk 2FA.
- `national_holidays`: data tanggal merah.

## Istura Open

- `open_events`: event perorangan, lifecycle, poster, copy promo.
- `open_event_days`: tanggal event, kuota, link grup, feedback token.
- `open_registrations`: pendaftar, NIK terenkripsi/hash, WhatsApp, add-on, headcount.
- `open_feedbacks`: feedback per hari Istura Open.
- `open_registration_sequences`: counter kode Istura Open.

## Tabel Sistem Laravel

- `sessions`
- `cache`
- `jobs`
- `job_batches`
- `failed_jobs`
- `personal_access_tokens`

## Relasi Utama

```text
users 1 -> * audit_logs
users 1 -> * trusted_devices
bookings 1 -> * booking_slots
bookings 1 -> * feedbacks
open_events 1 -> * open_event_days
open_events 1 -> * open_registrations
open_event_days 1 -> * open_feedbacks
```

## Data Sensitif

- `bookings.nik_encrypted`
- `open_registrations.nik_encrypted`
- surat permohonan di storage privat
- nomor WhatsApp dan data peserta

Gunakan migration dan model sebagai sumber kebenaran ketika membuat query/manual export.
