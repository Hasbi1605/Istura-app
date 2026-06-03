---
name: deep-security-threat-auditor
description: >
  Audit security defensif mendalam. Gunakan untuk mencari vulnerability, broken access
  control, IDOR, auth/session risk, injection, data exposure, unsafe upload, webhook spoofing,
  secrets/config risk, dependency risk, dan trust-boundary issue. Default read-only dan safe.
---

# Deep Security Threat Auditor untuk Antigravity

Tujuan skill ini: audit keamanan defensif berbasis bukti pada codebase atau environment yang user berwenang uji.

## Safety Boundary

- Audit hanya target lokal atau sistem yang jelas diotorisasi user.
- Jangan exfiltrate secrets, token, cookies, private key, PII, atau data user. Laporkan lokasi dengan redaksi.
- Hindari payload destruktif, persistence, evasion, credential harvesting, atau scanning pihak ketiga.
- Untuk production/live, rekomendasikan verifikasi non-destruktif dan minta izin sebelum command aktif.

## Workflow

1. Petakan security map: README, manifest, routes, middleware, guards, policies, schema, API clients, env example, CI, deploy config, tests.
2. Identifikasi aset: user data, admin action, file, token, payment, PII, internal API, privileged operation.
3. Identifikasi trust boundary: browser/server, public/private route, auth/role, external integration, queue/job, storage/cache, webhook.
4. Map flow per role: actor -> entry -> authn/authz -> validation -> data access/mutation -> response/logging.
5. Tambah abuse variants: unauthenticated, wrong role, ownership mismatch, tampered ID, replay, duplicate submit, path/file manipulation, webhook spoof.
6. Verifikasi aman dengan static evidence, tests, route dumps, dependency audit, local non-destructive requests.
7. Untuk audit luas, baca `references/threat-taxonomy.md` dari folder skill ini.

## Fokus

- Broken access control, IDOR, missing server policy, mass assignment.
- Auth/session/token leakage, weak reset/logout/session invalidation.
- SQL/NoSQL/command/template injection, XSS, SSRF, path traversal, unsafe deserialization.
- Overbroad API response, public storage, verbose errors, logs berisi secret/PII.
- Upload unsafe type, executable files, archive extraction, image/PDF processing risk.
- Webhook signature/replay/idempotency.
- Debug mode, permissive CORS, unsafe headers, committed secrets.

## Output

```markdown
**Ringkasan**
1-3 kalimat risiko security utama.

**Trust Boundary & Flow Map**
- Flow/asset: actor -> entry point -> guard -> sensitive operation -> output/logging.

**Findings**
- [Severity | Confidence] Title
  Asset/flow: ...
  Threat scenario: ...
  Evidence: file/line, route, config, test, log, atau runtime behavior.
  Safe verification: ...
  Impact: ...
  Suggested fix: ...
  Regression test: ...

**Verification**
- Ran/inspected:
- Could not verify:

**Next Steps**
- Remediasi prioritas.
```

## Fix Mode

Jika user minta fix, tambahkan regression test bila ada infra, perbaiki enforcement di server-side trust boundary, gunakan least privilege dan allowlist, lalu jalankan verifikasi relevan.

