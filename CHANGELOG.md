# Changelog

## 2026-06-30

- Merapikan dokumentasi handover ISTURA untuk mentor dan penerus teknis: README baru,
  struktur `docs/`, panduan deployment/domain migration, runbook operasional, security policy,
  ringkasan database, dan arsip dokumen SEO/GEO lama.
- Membersihkan drift dokumentasi: env production tidak lagi menyebut TTL Pending, path
  `CODEBASE-CONTEXT.md` dipindah ke `docs/`, dan referensi setup/QA README disesuaikan dengan
  repo saat ini.
- Menyiapkan catatan migrasi domain: template env dibuat netral, redirect host lama mendukung
  daftar multi-host, workflow deploy bisa memakai GitHub Variables, dan health check deploy
  bisa diganti host-nya lewat `HEALTHCHECK_HOST`.

## Catatan

Riwayat perubahan lama yang dicatat agent masih tersimpan di `AGENTS.md` bagian
`## Changelog`. File ini dimulai sebagai changelog human-readable untuk handover GitHub.
