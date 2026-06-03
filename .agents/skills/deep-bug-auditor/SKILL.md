---
name: deep-bug-auditor
description: >
  Audit bug fungsional mendalam di seluruh codebase. Gunakan untuk cari bug tersembunyi,
  user-flow defect, contract mismatch, state/race issue, validasi salah, data integrity bug,
  regression risk, atau investigasi correctness tanpa stack trace jelas. Default read-only.
---

# Deep Bug Auditor untuk Antigravity

Tujuan skill ini: menemukan bug fungsional berbasis bukti, bukan style issue atau preferensi refactor.

## Prinsip

- Default read-only. Edit hanya jika user minta fix.
- Telusuri end-to-end: UI -> route/API -> validation -> handler/service/state -> database/external API -> response -> hasil user.
- Pisahkan confirmed bug, likely bug, test gap, dan ambiguitas produk.
- Jangan laporkan hal generik kecuali menyebabkan perilaku salah.
- Confidence wajib: confirmed, high, medium, low.

## Workflow Audit

1. Petakan sistem: README, issue/plan, manifest, routes, middleware, schema/migration, queues/jobs, schedules, tests, entry point.
2. Petakan flow utama per role dan state: create/update/delete/list/detail/login/permission/error/retry/refresh/cancel/duplicate submit.
3. Bandingkan kontrak: frontend vs backend validation, payload vs response shape, enum/status, nullable, timezone, ownership, DB constraints.
4. Cari area rawan: authz bypass, stale UI, lost update, missing transaction, cache invalidation, async retry, webhook idempotency.
5. Verifikasi aman: targeted tests, typecheck, lint, route list, local browser/API flow jika bisa dan tidak destruktif.
6. Untuk audit luas, baca `references/bug-taxonomy.md` dari folder skill ini.

## Output

```markdown
**Ringkasan**
1-3 kalimat risiko bug paling penting.

**Flow Map**
- Flow: entry -> key code paths -> success/failure states.

**Findings**
- [Severity | Confidence] Title
  Flow: ...
  Evidence: file/line, route, test, log, atau runtime behavior.
  Reproduction: ...
  Root cause: ...
  Impact: ...
  Suggested fix/verification: ...

**Verification**
- Ran/inspected:
- Could not verify:

**Next Steps**
- Prioritas fix/test.
```

## Fix Mode

Jika user minta fix:

1. Tambah failing test dulu untuk bug penting bila test infra ada.
2. Buat patch minimal di akar masalah, bukan gejala.
3. Jalankan verifikasi tertarget dan test lebih luas bila blast radius besar.
4. Ringkas file berubah, test, risiko tersisa, dan area yang tidak bisa diverifikasi.

