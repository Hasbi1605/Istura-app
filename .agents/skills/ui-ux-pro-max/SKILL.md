---
name: ui-ux-pro-max
description: >
  UI/UX design intelligence with searchable local database. Gunakan untuk memilih style,
  color, typography, chart, UX guideline, React/Next/React Native/web stack pattern,
  atau validasi UI sebelum implementasi. Includes scripts and CSV data in this skill folder.
---

# UI UX Pro Max untuk Antigravity

Skill ini memakai database lokal: style, color, font pairing, UX guideline, chart, landing pattern, dan stack guidance.

## Jalankan Search Tool

Pilih path yang ada:

```bash
python3 .agents/skills/ui-ux-pro-max/scripts/search.py "<query>" --design-system -p "Project Name"
```

Fallback global Antigravity:

```bash
python3 ~/.gemini/config/skills/ui-ux-pro-max/scripts/search.py "<query>" --design-system -p "Project Name"
```

Jika Python belum ada, cek dulu:

```bash
python3 --version || python --version
```

## Workflow

1. Ekstrak kebutuhan: product type, audience, platform, tone, density, stack, constraints.
2. Selalu mulai dengan design system:
   `python3 <skill-path>/scripts/search.py "<product industry keywords>" --design-system -p "<Project>"`
3. Tambah domain search bila perlu:
   - `--domain product`
   - `--domain style`
   - `--domain color`
   - `--domain typography`
   - `--domain chart`
   - `--domain ux`
   - `--domain landing`
   - `--domain react`
   - `--domain web`
4. Untuk stack:
   - `--stack react`
   - `--stack nextjs`
   - `--stack react-native`
   - `--stack html-tailwind`
   - `--stack vue`, `svelte`, `laravel`, `flutter`, dll jika data ada.
5. Sintesis output search dengan konteks repo. Jangan menyalin rekomendasi mentah bila bertentangan dengan design system project.

## Persist Design System

Jika user ingin design system reusable:

```bash
python3 <skill-path>/scripts/search.py "<query>" --design-system --persist -p "Project Name"
```

Untuk page override:

```bash
python3 <skill-path>/scripts/search.py "<query>" --design-system --persist -p "Project Name" --page "dashboard"
```

## Final UI Checklist

- No emoji as structural icon.
- Consistent icon family and stroke/fill style.
- Touch/click targets large enough.
- Loading/empty/error/disabled/focus states.
- Light/dark contrast checked if both themes exist.
- Safe-area or fixed UI clearance on mobile.
- Reduced motion considered.
- 4/8 spacing rhythm, stable responsive gutters, no horizontal overflow.

