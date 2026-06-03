---
name: deep-optimization-auditor
description: >
  Audit optimasi read-only untuk performance, scalability, reliability, maintainability,
  cost, build/CI, cache, queue, database, frontend bundle, dan developer loop. Gunakan
  untuk roadmap optimasi berbasis bukti, bukan patch langsung.
---

# Deep Optimization Auditor untuk Antigravity

Skill ini menghasilkan rekomendasi optimasi prioritas tinggi berdasarkan arsitektur, jalur runtime, data access, cache, queue, dependency, build, dan operasi.

## Batas Read-Only

Allowed:

- Baca file dengan `rg`, `rg --files`, `find`, `sed`, `git diff`, `git log`.
- Baca manifest, lockfile, config, CI, migrations/schema, routes, tests, logs repo, docs.
- Jalankan diagnostics read-only yang tidak menulis artifact.

Ask first:

- Test/build/server/browser/worker yang bisa menulis cache, snapshot, coverage, database, atau artifact.
- Install/update package, clear cache, migration, seed, benchmark, load test, atau akses service eksternal.

Never:

- Edit file, stage, commit, push, migrate DB, seed data, hapus cache, atau run load test live dalam mode audit.

## Workflow

1. Petakan sistem: entry point, manifest, lockfile, config, CI, deploy, routes, schema/index, jobs, schedules, observability.
2. Identifikasi flow mahal: dashboard, list/search/report, import/export, upload, notification, sync, admin, analytics.
3. Bangun hipotesis: N+1, missing index, unbounded query, over-fetching, sync slow work, cache gap, expensive serialization, bundle berat, duplicated work.
4. Verifikasi aman dengan bukti statis, schema/index, route dump, existing logs/tests, dependency graph.
5. Baca `references/optimization-taxonomy.md` untuk audit luas.
6. Prioritaskan berdasarkan impact, effort, risk, confidence, dan blast radius.

## Output

```markdown
**Ringkasan**
1-3 kalimat peluang optimasi utama dan constraint.

**System Map**
- Area/flow: entry point -> code paths -> data/cache/queue/external resource -> output.

**Findings**
- [Priority | Confidence | Category] Title
  Flow/resource: ...
  Evidence: file/line, route, schema, config, test, log, atau artifact read-only.
  Impact: latency/throughput/memory/cost/reliability/maintainability/dev loop.
  Effort/risk: low/medium/high + alasan.
  Safe verification: command, metric, profile, query plan, test, atau manual check.
  Suggested direction: arah implementasi, bukan patch.

**Roadmap**
- Quick wins:
- Medium improvements:
- Strategic work:

**Verification**
- Ran/inspected:
- Could not verify:
```

## Handoff

Jika user ingin implementasi setelah audit, beri plan singkat per finding dan minta izin eksplisit sebelum mengubah file.

