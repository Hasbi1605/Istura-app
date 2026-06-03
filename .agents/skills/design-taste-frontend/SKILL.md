---
name: design-taste-frontend
description: >
  Senior UI/UX frontend engineering skill. Gunakan untuk high-craft React/Next UI,
  dashboard atau app interface yang perlu rasa premium, strong layout, state lengkap,
  dependency discipline, motion tepat, dan anti-generic AI UI.
---

# Design Taste Frontend untuk Antigravity

Baseline default: design variance 8, motion intensity 6, visual density 4. Ubah hanya jika user meminta arah berbeda.

## Stack Discipline

- Cek `package.json` sebelum import library seperti Framer Motion, GSAP, Phosphor, Radix, Zustand, shadcn.
- Jangan gunakan library yang tidak ada tanpa memberi install command atau alternatif native.
- Ikuti stack repo. React/Next: isolasi komponen interaktif dengan client component. Server component hanya layout statis.
- Tailwind: cek versi. Jangan pakai sintaks v4 di v3 project.

## Anti-Slop Rules

- No emojis.
- No Inter for premium/creative UI. Prefer Geist, Satoshi, Outfit, Cabinet Grotesk, JetBrains Mono for technical data.
- No generic purple/blue AI gradient, neon glow, pure black, over-saturated accent.
- Max one accent color, keep neutral base consistent.
- No generic three-card feature row; use asymmetric grid, zig-zag, bento, or horizontal flow.
- No fake generic names like John Doe, Acme, Nexus, SmartFlow.

## Layout & Responsiveness

- Use CSS Grid for structure, not flex percentage math.
- Use `min-h-[100dvh]` for full-height sections, never `h-screen` for hero.
- High variance layouts must collapse to single column under `md` with safe gutters.
- Do not nest cards inside cards. Use cards only when elevation communicates hierarchy.
- Stable dimensions for boards, counters, toolbars, tiles, and fixed-format UI.

## Interaction States

Build complete cycles for important workflows:

- Loading skeletons matching layout.
- Empty states explaining next action.
- Inline errors.
- Focus, hover, active tactile feedback.
- Disabled states with semantic disabled behavior.

## Motion & Performance

- Animate transform and opacity only.
- Continuous hover/magnetic effects must not use React state per mouse move. Use motion values or CSS.
- Add cleanup for `useEffect` animations.
- Avoid z-index spam; reserve layers for sticky nav, modal, overlay.
- Heavy perpetual animation must be isolated in tiny client components.

## Preflight

- Mobile no horizontal scroll.
- Text fits containers.
- Empty/loading/error states exist.
- Imports exist in manifest.
- Lint/build/test or browser screenshot done when feasible.

