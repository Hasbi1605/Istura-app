# Istura App Agent Rules

Aturan ini berlaku untuk pekerjaan di repo `/Users/macbookair/istura-app`.

## Prinsip Kerja

- Pahami konteks repo sebelum edit. Jangan mulai dari asumsi framework atau struktur folder.
- Untuk permintaan sederhana, langsung implementasikan perubahan kecil yang tepat.
- Untuk perubahan lintas modul, bug ambigu, auth/security, data, atau UI penting, lakukan investigasi dulu lalu buat rencana singkat.
- Utamakan solusi paling kecil yang menyelesaikan perilaku user-facing tanpa mengubah area lain.
- Jangan berhenti pada proposal kecuali user memang meminta analisis saja.

## Peta Repo Cepat

- Backend utama: `app/`, `routes/`, `config/`, `database/`.
- Frontend/assets: `resources/js`, `resources/css`, `resources/views`, `public/`.
- Test: `tests/Feature`, `tests/Unit`.
- Build frontend: `npm run build`.
- Test Laravel: `composer test` atau `php artisan test`.
- Formatter PHP tersedia lewat Laravel Pint jika relevan.

## Investigasi Wajib

- Pakai `rg` atau `rg --files` untuk mencari route, controller, service, model, migration, view, komponen JS, dan test.
- Untuk route/API, cek file route lalu ikuti controller/service/model sampai storage/database.
- Untuk UI, cek view/component, state JS, request API, loading/empty/error state, dan responsive behavior.
- Untuk bug, cari alur reproduksi, data yang masuk, validasi, authorization, state sebelum/sesudah, dan efek samping.

## Laravel Standards

- Ikuti pola Laravel yang sudah dipakai repo.
- Validasi input di boundary request/controller/action yang tepat.
- Jangan bypass policy, middleware, guard, CSRF, Sanctum/session behavior, atau authorization check.
- Untuk migration/schema, pikirkan data lama, rollback, default value, dan nullable behavior.
- Untuk query, hindari N+1 dan eager-load relasi bila view/API membutuhkan data relasi.
- Untuk file upload/storage, cek MIME, size, path traversal, visibility, dan akses publik.

## Frontend Standards

- Ikuti struktur dan style yang sudah ada di `resources/`.
- UI harus usable pada desktop dan mobile. Pastikan teks tidak overflow/overlap.
- Tambahkan state yang wajar: loading, empty, error, disabled, success, dan validation feedback bila relevan.
- Jangan membuat landing page atau copy marketing kecuali diminta.
- Jangan menambah dependency UI besar tanpa alasan kuat dan persetujuan user.

## Edit Safety

- Cek status git sebelum perubahan besar dan sebelum final bila ada edit.
- Jangan revert perubahan user atau file tidak terkait.
- Jangan ubah `.env`, credential, token, key, dump, cache, atau file generated besar kecuali diminta jelas.
- Jangan menjalankan command destruktif, deploy production, SSH production, restart service production, atau migration production.
- Jika menemukan secret di file/history/log, redaksi nilainya dan laporkan risiko.

## Verifikasi

- Setelah perubahan backend/PHP: jalankan test yang relevan. Minimal `php artisan test --filter=...` bila ada target jelas, atau `composer test` untuk cakupan lebih luas.
- Setelah perubahan frontend/assets: jalankan `npm run build`.
- Setelah perubahan lint/format PHP: jalankan Pint untuk file terkait jika tersedia dan sesuai scope.
- Jika test/build gagal karena environment, dependency, atau data lokal, laporkan command dan error utama.
- Jangan klaim selesai tanpa menyebut verifikasi yang dijalankan atau alasan tidak bisa dijalankan.

## Skill Lokal

- Gunakan skill di `.agents/skills` bila cocok:
  - `analisis-codebase` untuk pemetaan repo/fitur.
  - `debug-bug` atau `deep-bug-auditor` untuk bug sulit.
  - `deep-security-threat-auditor` untuk auth, access control, upload, secret, webhook, dan data exposure.
  - `frontend-design`, `design-taste-frontend`, atau `ui-ux-pro-max` untuk UI penting.
  - `review-pr` dan `gh-pr-comment-followup` untuk PR/review.
- Baca `SKILL.md` secukupnya dan ikuti workflow skill. Jangan memuat semua referensi jika tidak perlu.

## Output ke User

- Gunakan Bahasa Indonesia yang jelas dan ringkas.
- Untuk tugas edit, final berisi perubahan utama, file penting, verifikasi, dan risiko sisa.
- Untuk audit/review, temuan risiko tampil dulu, urut severity, dengan bukti file/line.
- Jika ada asumsi, tulis eksplisit dan singkat.
