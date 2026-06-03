---
name: gpt-taste
description: >
  Use only when user explicitly says $gpt-taste, gpt-taste, gpt-tasteskill, or asks for this exact skill.
  Applies Awwwards-level frontend direction, GSAP-heavy motion, cinematic landing pages,
  experimental visual pages, and high-end interactive builds. Do not auto-trigger for CRUD,
  dashboards, ordinary UI polish, or maintenance.
---

# GPT Taste untuk Antigravity

Use only on explicit invocation. Goal: highly visual, memorable, motion-rich frontend build with production-grade spacing and exact implementation.

## Pre-Code Design Plan

Before writing UI code, produce a compact `<design_plan>` with:

1. Deterministic selection based on prompt length: hero architecture, font stack, 3 component architectures, 2 motion paradigms.
2. AIDA map: Navigation, Attention hero, Interest section, Desire motion/media section, Action footer/CTA.
3. Hero math: H1 max width and clamp size. H1 must stay 2-3 lines, never 4+ lines.
4. Bento math: prove grid spans fill without dead cells. Use dense grid flow where applicable.
5. Label/button sweep: no cheap meta labels, all buttons readable.

## Visual Rules

- Start with premium navigation.
- Use AIDA sequence with big vertical spacing: `py-32` or `py-48` where appropriate.
- Hero must be cinematic and wide. No narrow 6-line H1, no arbitrary stamps, no spam tags, no raw stats in hero.
- Use reliable assets such as `https://picsum.photos/seed/{context}/1920/1080` when no project assets exist. Match seed to domain.
- Wrap page root with `overflow-x-hidden w-full max-w-full` when animations can move off-canvas.
- No emojis in code, comments, content, or alt text.
- No meta labels like `SECTION 01`, `QUESTION 05`, `ABOUT US`.

## Motion Rules

- Prefer GSAP with `@gsap/react` and `ScrollTrigger` for scrolltelling, pinning, scrubbing, stacking, image scale/fade.
- Check `package.json` before importing GSAP. If missing, propose install command or implement CSS fallback when user forbids dependencies.
- Every clickable card/image should have hover physics via transform/opacity, not layout properties.
- Clean up GSAP contexts in `useEffect`/`useGSAP`.
- Do not mix GSAP/ThreeJS/Framer in the same component tree unless isolated cleanly.

## Component Arsenal

Pick from: inline typography images, horizontal accordions, infinite marquees, portrait testimonial carousel, gapless bento, pinned split scroll, image scale/fade, scrubbed word reveal, card stacking.

## Verification

- Run lint/build when available.
- Use browser screenshot for desktop/mobile if app can run.
- Check H1 line count, button contrast, horizontal overflow, bento gaps, reduced-motion fallback, and animation cleanup.

