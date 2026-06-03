# Optimization Audit Report Template

Use this longer format when the user asks for a formal report, whole-codebase audit, or roadmap document.

```markdown
**Ringkasan Eksekutif**
- Kondisi utama:
- Peluang terbesar:
- Batas verifikasi:

**Scope Read-Only**
- Repo/branch:
- Area yang diperiksa:
- Hal yang sengaja tidak dijalankan:

**System Map**
- Runtime/app entry:
- Frontend paths:
- Backend/API paths:
- Data/storage/cache:
- Queues/schedulers:
- External integrations:
- Build/CI/deploy:

**Top Findings**

1. [P1 | High confidence | Data access] Judul
   - Flow/resource:
   - Evidence:
   - Impact:
   - Effort/risk:
   - Safe verification:
   - Suggested direction:

2. [P2 | Medium confidence | Architecture] Judul
   - Flow/resource:
   - Evidence:
   - Impact:
   - Effort/risk:
   - Safe verification:
   - Suggested direction:

**Roadmap Prioritas**
- Quick wins:
- Medium improvements:
- Strategic work:

**Metrics Yang Perlu Ditambahkan**
- Latency:
- Database:
- Cache:
- Queue:
- Frontend:
- CI/dev loop:

**Verification Log**
- Inspected:
- Read-only commands run:
- Could not verify:

**Risiko Dan Dependensi**
- Product/data assumptions:
- Rollout risks:
- Areas needing owner input:
```

Keep report concise. If there are more than 10 findings, group lower-priority items by theme and keep detail for top items only.
