---
name: analisis-codebase
description: >
  Gunakan saat user meminta pemetaan repo, entry point, struktur folder, alur fitur,
  route/controller/service/model/database, atau konteks awal sebelum membuat plan atau coding.
  Mode default read-only.
---

# Analisis Codebase untuk Antigravity

Pakai skill ini untuk memahami codebase secara sistematis sebelum memberi rencana atau mengubah file.

## Prinsip

- Default read-only. Jangan edit, patch, commit, atau refactor kecuali user eksplisit minta eksekusi.
- Mulai dari bukti repo: README, package manifest, config, route, entry point, schema/migration, test.
- Pakai `rg --files` dan `rg` lebih dulu sebelum membuka banyak file.
- Bedakan fakta yang terlihat dari asumsi yang belum pasti.
- Gunakan bahasa user. Jika user pakai Indonesia, jawab Indonesia.

## Workflow

1. Temukan bentuk project: stack, package manager, direktori utama, entry point backend/frontend/worker/CLI.
2. Baca file konfigurasi kunci: manifest, env example, route config, bootstrap, service provider, build config.
3. Telusuri area fitur yang diminta: UI -> route/API -> handler/controller -> service/state -> model/query/storage -> response.
4. Catat file penting beserta perannya.
5. Sorot info yang berguna untuk plan atau file issue, tanpa membuat file kecuali diminta.
6. Tulis area yang belum sempat diverifikasi.

## Output

```markdown
# Analisis Codebase
## Ringkasan Struktur
## Entry Point
## Modul / File Penting
## Alur Fitur
## Fakta vs Asumsi
## Risiko / Catatan
```

## Batas

- Jangan menebak perilaku database, integrasi, atau arsitektur tanpa dasar kode.
- Jangan menjalankan perintah yang mengubah state seperti migration, seed, install, format, atau generate artifact.
- Jika perlu runtime untuk memastikan alur, sebutkan command yang disarankan dan risikonya.

