---
name: gh-pr-comment-followup
description: >
  Gunakan untuk menindaklanjuti komentar review GitHub PR: baca thread terakhir,
  implementasikan masukan valid, sanggah masukan keliru, jalankan test, balas PR singkat,
  dan merge hanya jika review terbaru jelas approve tanpa blocker.
---

# GH PR Comment Follow-up untuk Antigravity

Skill ini untuk tahap eksekusi setelah review PR punya komentar aksi. Jangan ulang review penuh kecuali konteks thread tidak jelas.

## Workflow

1. Identifikasi PR dan komentar/thread terakhir. Jika input URL PR/komentar, baca konteks sekitar dulu.
2. Tentukan validity:
   - Terima saran yang meningkatkan correctness, safety, tests, maintainability, atau docs tanpa melebar scope.
   - Tolak saran yang salah, regresif, atau bertentangan dengan issue/plan/kode sekitar.
3. Implementasikan hanya bagian valid. Patch minimal dan mudah ditautkan ke thread asal.
4. Tambah/perbarui test untuk perubahan perilaku.
5. Jalankan lint/test/build relevan.
6. Balas PR via `gh pr comment` dengan ringkas: apa diubah, apa tidak diubah, verifikasi.
7. Merge hanya jika review terbaru benar-benar approve dan tidak ada blocker.

## Guardrails

- Jangan menganggap komentar otomatis benar.
- Jangan refactor tidak terkait.
- Jangan merge jika review terakhir bukan approval.
- Gunakan GitHub CLI untuk komentar, merge, dan inspeksi bila tersedia.

## Output Akhir

- Komentar diimplementasikan atau ditolak.
- File berubah.
- Test/check dijalankan.
- Perubahan yang sengaja tidak dilakukan.
- Status PR/merge jika dilakukan.

