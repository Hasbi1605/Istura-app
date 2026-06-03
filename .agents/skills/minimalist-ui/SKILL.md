---
name: minimalist-ui
description: >
  Gunakan untuk UI minimalis editorial, warm monochrome, bento flat, typographic contrast,
  muted pastels, workspace/document-style interface, dan premium utilitarian design.
  Bukan untuk gradient/neon/glassmorphism berat.
---

# Minimalist UI untuk Antigravity

Target: premium utilitarian minimalism, document-style, flat, tenang, rapi, dan mahal tanpa dekorasi berisik.

## Banned

- No Inter, Roboto, Open Sans.
- No Lucide/Feather/Heroicons sebagai default ikon; prefer Phosphor atau Radix jika tersedia.
- No default heavy shadows, gradients, neon, 3D glassmorphism, large pill containers.
- No emojis.
- No generic names, lorem ipsum, atau copywriting klise seperti Elevate, Seamless, Unleash, Next-Gen.

## Typography

- Body/UI: `SF Pro Display`, `Geist Sans`, `Helvetica Neue`, `Switzer`, sans-serif.
- Editorial heading/quote: `Lyon Text`, `Newsreader`, `Playfair Display`, `Instrument Serif`, serif.
- Mono: `Geist Mono`, `SF Mono`, `JetBrains Mono`, monospace.
- Body text off-black, never pure black; generous `line-height: 1.6`.

## Palette

- Canvas: `#FFFFFF`, `#F7F6F3`, or `#FBFBFA`.
- Surface: `#FFFFFF` or `#F9F9F8`.
- Borders: `#EAEAEA` or `rgba(0,0,0,0.06)`.
- Muted pastel only for semantic accents: pale red, blue, green, yellow.

## Components

- Bento cards: asymmetric grid, `1px solid #EAEAEA`, radius 8-12px, padding 24-40px.
- CTA: `#111111` background, white text, radius 4-6px, no shadow, active `scale(0.98)`.
- FAQ accordion: no box, separate with bottom border, `+`/`-` toggle.
- Shortcuts: use semantic `<kbd>` with border/background and mono font.
- Faux OS window: white top bar + three subtle circles, only when mocking software.

## Motion

- Quiet scroll reveal: opacity + `translateY(12px)` over 600ms.
- Use IntersectionObserver, not raw scroll listeners.
- Animate only transform/opacity.
- Optional ambient background must be fixed, pointer-events none, ultra-low opacity.

## Verification

- Check contrast, spacing rhythm, no gradients/heavy shadows, no emoji, no overflow, no low-contrast text.
- Run build/lint or screenshot when feasible.

