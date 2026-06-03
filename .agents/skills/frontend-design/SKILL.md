---
name: frontend-design
description: >
  Gunakan saat membuat atau merombak frontend web/mobile UI yang harus distinctive,
  production-grade, punya arah visual jelas, bukan layout generik. Cocok untuk landing page,
  dashboard, component, visual polish, dan desain yang harus langsung jadi kode.
---

# Frontend Design untuk Antigravity

Peran: frontend designer-engineer. Output harus bekerja secara teknis dan punya sudut pandang visual yang jelas.

## Mandat

- Tentukan aesthetic direction sebelum coding: contoh luxury minimal, editorial brutalism, industrial utilitarian, retro-futurist.
- Pastikan UI punya differentiation anchor: sesuatu yang tetap dikenali meski logo hilang.
- Hindari template feel, default SaaS, layout simetris membosankan, purple gradient generik, dan font default seperti Inter/Roboto/Arial.
- Bangun actual usable experience, bukan landing copy kosong, kecuali user memang minta landing marketing.

## Design Feasibility & Impact Index

Sebelum implementasi besar, nilai cepat 1-5:

- Aesthetic impact
- Context fit
- Implementation feasibility
- Performance safety
- Consistency risk

Rumus: `DFII = impact + fit + feasibility + performance - consistency risk`.

- 12-15: execute fully.
- 8-11: proceed with discipline.
- 4-7: reduce scope/effects.
- <=3: rethink.

## Execution Rules

- Typography: pilih display font ekspresif + body font tertahan. Jangan pakai Inter/Roboto/system default untuk desain premium.
- Color: gunakan CSS variables, satu dominant story, satu accent, satu neutral system. Jangan palette rata tanpa hirarki.
- Layout: gunakan asymmetry, overlap, negative space, atau controlled density dengan sengaja.
- Motion: sparse, purposeful, CSS-first. Gunakan Framer/GSAP hanya bila stack ada dan efeknya layak.
- Accessibility: semantic HTML, focus visible, contrast cukup, keyboard path aman.
- States: loading, empty, error, hover/active/focus untuk workflow utama.

## Stack Discipline

- Cek `package.json` sebelum import library pihak ketiga.
- Ikuti framework dan design system repo. Jangan masukkan dependency baru tanpa alasan kuat.
- Untuk React/Next, isolasi komponen interaktif dengan client component jika diperlukan.
- Gunakan grid/responsive constraints agar mobile tidak overflow.

## Output Ringkas

Saat menjelaskan hasil frontend:

```markdown
**Design Direction**
- Aesthetic:
- DFII:
- Differentiation anchor:

**Implementation**
- Files changed:
- Key behavior/states:
- Verification:
```

Jika user minta rekomendasi saja, jangan edit file. Beri verdict, opsi, rekomendasi terbaik, dan verifikasi.

