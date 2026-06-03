# Deep Security Threat Taxonomy

Use this reference for broad defensive security audits. Report only threats with a credible path to impact.

## Severity

- Critical: unauthenticated or low-privilege compromise of sensitive data, account takeover, remote code execution, payment/security break, widespread data corruption, or production secrets exposure.
- High: authenticated privilege escalation, IDOR over sensitive resources, reliable injection, major data exposure, webhook/payment abuse, or destructive operation without proper authorization.
- Medium: narrower data leak, missing defense-in-depth on sensitive flows, risky config, weak audit trail, or exploit requiring uncommon conditions.
- Low: limited hardening issue, low-impact misconfiguration, or security test gap without a clear exploit path.

## Trust-Boundary Questions

- Who can enter this route, endpoint, job, webhook, or CLI command?
- Which identity and role are trusted, and where are they verified server-side?
- Which object ownership or tenant boundary must hold?
- Which inputs cross from untrusted to trusted code?
- Which data is sensitive, and where can it be returned, logged, cached, exported, or stored?
- Which external service can call this system, and how is authenticity verified?
- Which tests prove the negative case: wrong role, wrong owner, tampered ID, invalid token, replay, malicious input?

## Threat Patterns

### Access Control

- Endpoint lacks middleware/policy while UI hides the action.
- Controller/service checks role but not object ownership or tenant.
- Admin-only fields can be modified through mass assignment or generic update payloads.
- Sequential IDs allow cross-user object access.
- Soft-deleted or archived objects remain accessible through alternate routes.

### Authentication And Sessions

- Password reset tokens are not single-use or expire too slowly.
- Session/cookie settings miss secure, httpOnly, sameSite, or rotation expectations.
- Logout does not revoke sessions/tokens where the app expects revocation.
- Email/phone verification is checked in UI but not in sensitive backend paths.
- OAuth callback trusts unvalidated state, redirect, or email fields.

### Injection And Input Handling

- Raw SQL, shell commands, template rendering, LDAP/search filters, or NoSQL queries include untrusted input.
- Markdown/HTML rendering lacks sanitization.
- User-controlled URLs are fetched server-side without allowlist, enabling SSRF.
- File paths or archive entries are joined without canonical path checks.
- JSON/XML/YAML parsing enables unsafe deserialization or entity expansion.

### Data Exposure

- API serializers return secrets, tokens, internal notes, PII, or role-only fields.
- Logs include Authorization headers, cookies, reset links, full request bodies, or secrets.
- Storage objects are public by default or have guessable paths.
- Error pages expose stack traces, SQL, env, or internal service details.
- Cache keys do not include user/tenant scope.

### Files And Content

- Upload validation trusts MIME type or extension only.
- Uploaded files can be served from executable paths.
- Image/PDF/document processing uses unsafe external tools or unbounded resources.
- Archive extraction allows path traversal or zip bombs.
- Download endpoints miss ownership checks or content-disposition safety.

### External Integrations

- Webhooks lack signature validation, timestamp checks, or replay protection.
- Third-party callbacks accept untrusted redirect URLs.
- Retry handling duplicates non-idempotent side effects.
- Background jobs process attacker-controlled payloads without revalidating permissions.
- Payment or subscription state trusts client-provided status.

### Secrets, Config, And Supply Chain

- Real secrets are committed, logged, embedded in frontend bundles, or included in examples.
- Debug mode, permissive CORS, weak CSP, or insecure headers are enabled for production.
- CI exposes tokens to untrusted branches or pull requests.
- Dependency versions are vulnerable or install scripts execute untrusted code.
- Docker/Kubernetes/cloud configs run with excessive privileges.

### Auditability And Detection

- Privileged actions lack actor, target, timestamp, and outcome logs.
- Security logs include sensitive payloads.
- Failed authz/authn events are not observable.
- Rate limiting is absent on login, reset, invite, OTP, export, or expensive search endpoints.

## Safe Verification Checklist

Before reporting a threat, try to gather:

- File and line evidence for missing or weak control.
- A minimal local route/request/test idea that demonstrates the risk safely.
- Expected protection from nearby patterns, docs, tests, or framework conventions.
- Actual behavior from code, tests, config, or local runtime.
- A realistic attacker role and prerequisite.
- A concrete affected asset or user impact.

Redact secrets in reports. Show only a short prefix/suffix when necessary to prove identity of a secret-like value.
