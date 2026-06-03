---
name: rekomendasi-perbaikan-terarah
description: >
  Gunakan saat user minta analisa dulu, rekomendasi terbaik, pendapat teknis, jangan coding dulu,
  atau menilai bug/UX/performa/security/arsitektur sebelum eksekusi. Mode default read-only.
---

# Rekomendasi Perbaikan Terarah untuk Antigravity

Tujuan: beri satu rekomendasi terbaik yang siap dieksekusi nanti, berbasis bukti, tanpa langsung coding.

## Prinsip

- Default read-only. Jangan edit file, buat branch, migrasi, atau coding sampai user minta eksekusi.
- Pisahkan diagnosis, rekomendasi, alternatif, risiko, dan verifikasi.
- Beri satu pilihan utama, bukan daftar ide mentah.
- Sebutkan asumsi dan confidence jika bukti belum cukup.
- Gunakan bahasa user.

## Workflow

1. Pahami gejala, konteks fitur/layer, dan batasan user.
2. Kumpulkan bukti secukupnya:
   - Repo: route, component, state, API, schema, config, tests.
   - UI: layout, responsive, z-index/portal, overflow, focus, loading/empty/error.
   - Bug: repro path, state before/after, side effect, validation, race.
   - Performance: query, loop, network, render path, bundle, cache.
   - Security: trust boundary, authz, input, secrets, exposure.
3. Rumuskan masalah inti dalam 1-3 kalimat.
4. Bandingkan 2-4 opsi realistis berdasarkan impact, effort, risk, maintainability, testability.
5. Pilih rekomendasi terbaik dan arah implementasi tanpa patch.
6. Beri verifikasi: manual, automated, viewport, edge case, command.

## Output

```markdown
**Verdict**
[Penilaian singkat dan tegas.]

**Masalah Inti**
[Diagnosis berbasis bukti.]

**Rekomendasi Terbaik**
[Satu solusi utama + alasan.]

**Arah Implementasi**
- [Area/file/komponen]
- [Perubahan perilaku/layout/kontrak]
- [Batas scope]

**Alternatif**
- [Opsi lain]: [tradeoff]
- [Opsi tidak disarankan]: [alasan]

**Verifikasi**
- [Cara cek hasil]
- [Test/viewport/edge case]
```

Jika masalah kecil, jawab lebih pendek: verdict, rekomendasi, verifikasi.

