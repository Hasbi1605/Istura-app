# Optimization Taxonomy

Use this checklist during broad read-only audits. Report only items backed by code, config, schema, logs, metrics, or clear flow evidence.

## Data Access

- N+1 relation loading in list/detail/report/export flows.
- Missing eager loading or over-eager loading that fetches unused relations.
- Missing indexes for common filters, joins, ordering, uniqueness checks, or foreign keys.
- Unbounded queries without pagination, chunking, cursoring, or limits.
- Heavy aggregates computed repeatedly instead of cached, precomputed, or narrowed.
- `SELECT *` or broad serialization when only a few fields are needed.
- Filtering, sorting, or grouping done in application memory after large reads.
- Repeated identical queries inside loops, policies, presenters, resources, or accessors.
- Database writes without batching where batch APIs are available.
- Transactions that cover slow external work or unrelated operations.

## Request And API Paths

- Slow file, image, PDF, email, notification, export, sync, or webhook work done inline during user requests.
- External API calls inside latency-sensitive paths without timeout, cache, queue, or fallback.
- Repeated validation, hydration, mapping, policy checks, or serialization across layers.
- Over-fetching response payloads for tables, dashboards, dropdowns, or mobile clients.
- Missing pagination, cursor pagination, debouncing, search limits, or rate-aware controls.
- Retry loops without backoff, jitter, idempotency, or circuit-breaker behavior.
- Route/controller methods that mix orchestration, queries, mutation, rendering, and side effects.

## Cache And Derived State

- Expensive stable reads with no cache or precomputation.
- Cache invalidation too broad, too narrow, or coupled to unrelated writes.
- Cache keys missing tenant, role, locale, filter, permission, or user scope.
- Derived counts, badges, dashboard metrics, or reports recomputed per request.
- Duplicate caches across layers with inconsistent TTL or invalidation.
- Cache use that hides stale authorization-sensitive data.

## Queues, Jobs, And Schedulers

- Jobs not idempotent, not chunked, or not safe for retry.
- One job per record when batching would reduce overhead.
- Long-running jobs on same queue as user-critical work.
- Scheduled jobs scanning all records every run without incremental cursors.
- Missing backpressure, timeout, retry limit, or failure observability.
- Work split into async jobs but still awaited synchronously by caller.

## Frontend And Assets

- Large bundles from duplicate dependencies, broad imports, unused libraries, or all-routes-in-one chunk design.
- Expensive components rerendering due to unstable props, global state churn, or broad subscriptions.
- Repeated data fetching on navigation, focus, filter changes, or child mount.
- Tables/lists rendering too many rows without virtualization or pagination.
- Large unoptimized images, fonts, videos, maps, editors, charts, or dashboards loaded before needed.
- Missing route-level code splitting for admin/reporting/editor flows.
- Client-side filtering of large server-side data sets.

## Architecture And Maintainability

- Business rules duplicated across frontend/backend, controllers/services/jobs, or validators/policies.
- God controllers, services, models, or stores that concentrate unrelated responsibilities.
- Circular dependencies or implicit side effects that make performance changes risky.
- Domain concepts represented by scattered strings, enums, magic numbers, or status transitions.
- Repeated query/filter/pagination/export logic that should be centralized.
- Feature boundaries unclear enough that local changes require broad regression checks.
- Abstractions that add indirection without reuse, correctness, or performance benefit.

## Build, CI, And Developer Loop

- Slow installs due to unused dependencies, duplicate toolchains, or lockfile churn.
- Slow builds from non-incremental pipelines, broad transpilation, or heavy postinstall scripts.
- Test suites lacking targeted commands for changed areas.
- Coverage, snapshots, generated files, or caches written by default in ordinary verification commands.
- Flaky or order-dependent tests that reduce trust in optimization work.
- Local setup requiring services not documented or not containerized where expected.

## Reliability, Observability, And Operations

- Missing timeouts for HTTP, database, queue, cache, or filesystem operations.
- Missing metrics around latency, queue age, job duration, external API errors, cache hit rate, and slow queries.
- Logs too noisy, too expensive, or missing request/job correlation.
- Memory growth from reading entire files, exports, or result sets into memory.
- No graceful degradation for expensive optional widgets, reports, notifications, or integrations.
- Polling where webhooks, push, long polling, or smarter refresh intervals would reduce load.

## Cost

- Redundant storage of derived files, exports, images, or logs.
- Expensive third-party API calls repeated without cache or batching.
- Large artifacts retained indefinitely without policy.
- Background jobs recomputing unchanged data.
- Overbuilt infrastructure assumptions visible in config, CI, or deployment scripts.

## Prioritization Heuristic

Use this scoring language in reports:

- P0: urgent bottleneck or operational cost likely harming core flows now.
- P1: high-impact optimization with clear evidence and manageable rollout.
- P2: meaningful improvement, but impact depends on workload or data volume.
- P3: cleanup or future-proofing with lower immediate payoff.

Estimate effort as low, medium, or high. Estimate risk as low, medium, or high. Prefer recommendations with high impact, high confidence, low effort, and low rollout risk.
