# AGENTS.md — ISTURA App

## Tentang repo
Monolit **Laravel 13 (PHP 8.4) + React 19 (Vite/TypeScript)** satu origin untuk booking
kunjungan Istana Kepresidenan Yogyakarta (program ISTURA). Auth admin Sanctum + 2FA,
realtime via Reverb, data di MySQL.

## WAJIB dibaca dulu (context)
Sebelum mengubah kode, baca dokumen konteks ini agar tidak eksplorasi ulang:
1. `docs/CODEBASE-CONTEXT.md` — peta frontend & backend, fitur, dan flow user/admin. **Acuan utama.**
2. `PRD-ISTURA-APP.md` — produk, business rules (BR), requirement (FR/NFR), skema DB, state diagram.
3. `IsturaOpen.md` — PRD modul roadmap "Istura Open" (pendaftaran perorangan, modul terpisah).

Jika perubahanmu mengubah struktur folder, service, route, komponen, atau flow,
**perbarui `docs/CODEBASE-CONTEXT.md`** pada bagian yang relevan di PR yang sama.

## Cara bekerja
- Untuk tugas kompleks, mulai dengan plan singkat di percakapan sebelum menulis kode. Repo ini tidak memakai folder `issue/` atau PR flow lagi.
- Setelah verifikasi memadai, perubahan boleh langsung di-commit ke `main`, push ke remote, lalu deploy sesuai scope tugas.
- Gunakan perubahan sekecil mungkin yang menyelesaikan masalah. Jangan refactor besar kecuali diminta atau benar-benar diperlukan.
- Ikuti pola yang sudah ada: thin controller + Service, FormRequest untuk validasi,
  Resource untuk bentuk JSON (camelCase), Events untuk broadcast.
- Frontend: router berbasis state (`useIsturaData`), bukan URL. API lewat `resources/js/api/*`.
  Gunakan `realtime/echo.ts` (bukan `echo.js` legacy) untuk kode realtime baru.
- Jika ada ketidakpastian, nyatakan asumsi secara eksplisit.

## Verifikasi wajib
Setiap perubahan kode wajib diverifikasi pada area terdampak.
- **Backend (Laravel):** `php artisan test` (atau filter test relevan). Jika perilaku
  penting berubah tetapi test belum ada, tambahkan test dulu.
- **Frontend (React):** pastikan `npm run build` sukses (TypeScript strict). Untuk alur
  end-to-end gunakan skrip Playwright di `scripts/` saat dev server hidup.
- Jangan anggap tugas selesai bila test/relevansi build belum dijalankan.

### Perintah cepat
```bash
php artisan test            # backend
npm run build               # frontend (cek tipe + bundle)
php artisan serve           # dev server :8000
npm run dev                 # Vite HMR
php artisan reverb:start    # WebSocket
```

## Keamanan (jaga selalu)
- NIK selalu terenkripsi; jangan log/echo nilai NIK mentah. Surat permohonan tetap privat.
- Pertahankan rate-limit endpoint publik, validasi upload (mime + ≤5MB), security headers,
  dan absolute session lifetime admin. Jangan melonggarkan tanpa alasan eksplisit.
- Endpoint admin harus tetap di belakang `admin-access` / `super-admin` / 2FA sesuai kebutuhan.

## Ekspektasi output
Saat menyelesaikan tugas, ringkas: apa yang diubah, file utama yang disentuh, test yang
dijalankan, test yang ditambahkan, risiko/tindak lanjut, dan update changelog.

## Done when
- Tujuan tercapai, perubahan utama terimplementasi.
- Test relevan dijalankan (dan ditambahkan bila sebelumnya belum ada/memadai).
- `npm run build` lolos bila menyentuh frontend.
- `docs/CODEBASE-CONTEXT.md` diperbarui bila struktur/flow berubah.
- Entri changelog ditambahkan (lihat di bawah).
- Risiko & tindak lanjut diringkas.

---

## Aturan Changelog (WAJIB)
Setiap kali membuat atau melakukan perubahan pada repo ini, **catat entri changelog** di
bagian "## Changelog" di bawah. Aturan:
- Tambahkan entri baru di **paling atas** daftar (terbaru di atas).
- Format: `- YYYY-MM-DD — <ringkas perubahan> — file/area utama — (test: <hasil>)`.
- Satu entri per perubahan logis/PR. Tetap ringkas dan faktual.
- Jangan menghapus entri lama; changelog bersifat append-only sebagai jejak riwayat.

## Changelog
- 2026-06-10 — Menyempurnakan header widget WhatsApp mengambang: "Tim ISTURA" → "Asisten ISTURA", hapus sapaan redundan "Hai, aku MIKY!" (sudah ada di hero) jadi langsung kalimat ajakan, dan subtitle kini animasi typewriter saat panel expand (hormati `prefers-reduced-motion`, reserve tinggi agar tak ada layout shift). — `resources/js/components/layout/FloatingContact.tsx`, `resources/js/styles.css` — (test: `npm run build` pass)
- 2026-06-10 — Menyamakan tombol aksi widget WhatsApp mengambang: label "Chat via WhatsApp" diringkas jadi "WhatsApp" dan tombol WhatsApp & Instagram dibuat konsisten (lebar `flex: 1 1 0`, padding, font-size, gap, hover sama). — `resources/js/components/layout/FloatingContact.tsx`, `resources/js/styles.css` — (test: `npm run build` pass)
- 2026-06-10 — Menambahkan widget WhatsApp mengambang (FAB) di halaman publik (selain wizard booking): klik untuk expand kartu ber-aksen MIKY dengan 3 quick-topic prefill pesan WA, tombol utama "Chat via WhatsApp", dan tautan Instagram; nomor diambil dari `contacts`/CMS (bukan hardcode), aksesibel (Escape, klik-luar, fokus, `prefers-reduced-motion`). — `resources/js/components/layout/FloatingContact.tsx`, `resources/js/App.tsx`, `resources/js/styles.css`, `CODEBASE-CONTEXT.md` — (test: `npm run build` pass; diagnostics clean)
- 2026-06-10 — Menyesuaikan robots AI policy agar Google-Extended diizinkan untuk Gemini grounding, sambil tetap memblokir crawler training-only seperti GPTBot. — `app/Support/SeoMeta.php`, `public/robots.txt`, `tests/Feature/SeoMetadataTest.php` — (test: `php artisan test --filter=SeoMetadataTest` 4 pass; scoped `pint --test` pass)
- 2026-06-10 — Memperbaiki inkonsistensi FAQ: `faq-individu` kini eksplisit menyatakan individu boleh mendaftar, `faq-format-surat` diperjelas struktur kalimat agar lebih scannable dan welcoming. — `resources/js/constants.ts`, `database/seeders/data/faqs.json` — (test: `npm run build` pass; `php artisan test --filter=Cms` 6 pass)
- 2026-06-10 — Menambahkan fondasi SEO/GEO homepage: canonical metadata, sitemap XML, robots AI-search/training policy, JSON-LD, konten ringkasan server-rendered, redirect canonical non-www, env canonical, dan test SEO. — `config/seo.php`, `app/Support/SeoMeta.php`, `routes/web.php`, `resources/views/app.blade.php`, `resources/views/info/visit-flow.blade.php`, `public/robots.txt`, `.env.example`, `.env.production.example`, `tests/Feature/SeoMetadataTest.php`, `CODEBASE-CONTEXT.md` — (test: `php artisan test` 142 pass; `npm run build` pass; scoped `pint --test` pass)
- 2026-06-09 — Mengganti logo navbar & footer landing page dari versi putih ke versi emas (`gedung-agung-gold.webp`) agar selaras dengan hero; mencakup default backend, seed, fallback frontend, dan migrasi data `site_content` existing. — `app/Support/SiteContentDefaults.php`, `resources/js/constants.ts`, `resources/js/components/layout/Navigation.tsx`, `resources/js/components/layout/Footer.tsx`, `database/seeders/data/site_settings.json`, `database/migrations/2026_06_09_000001_use_gold_logo_in_site_content.php` — (test: `php artisan test --filter=Cms` 6 pass; `npm run build` pass; migrate pass)
- 2026-06-09 — Mengubah logo putih di navbar dan footer landing page menjadi hitam via `filter: brightness(0)` pada `.brand-lockup img` dan `.footer-logo`. — `resources/js/styles.css` — (test: `npm run build` pass)
- 2026-06-08 — Menambahkan `AGENTS.md` dan `docs/CODEBASE-CONTEXT.md` (peta FE/BE, fitur, flow user & admin, aturan changelog). — `AGENTS.md`, `docs/CODEBASE-CONTEXT.md` — (test: n/a, dokumentasi)
