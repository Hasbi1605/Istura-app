# Deep Bug Taxonomy

Use this reference for broad bug audits. Report issues only when there is a credible path to incorrect behavior.

## Severity

- Critical: data loss/corruption, privilege escalation, payment/security break, production outage, or primary flow unusable for many users.
- High: primary flow can fail or produce incorrect results for realistic users, but workaround may exist.
- Medium: localized incorrect behavior, edge-case break, stale state, confusing failure, or missing recovery in repeated workflows.
- Low: minor correctness issue, rare edge case, or test gap with limited known user impact.

## Flow Questions

- Who performs the action and under which role/permission?
- What input/state is required before the action?
- Which frontend route/component or API endpoint starts the flow?
- Which validations happen client-side and server-side?
- Which records are read or written?
- What should happen on success, failure, retry, refresh, and duplicate submit?
- Which tests cover this flow, and what do they omit?

## Bug Patterns

### Authorization

- UI hides an action but endpoint lacks a guard.
- Different routes for the same resource use different policy checks.
- Role checks use stale user/session data.
- Forbidden states redirect to a misleading page or leak object existence.

### Validation And Contracts

- Frontend sends a field name or type the backend does not accept.
- Backend allows values the UI cannot display or recover from.
- Required fields differ between create and update.
- Null, empty string, zero, and missing values are treated inconsistently.
- Enum/status labels differ between database, API, and UI.

### Data Integrity

- Multi-step writes lack a transaction.
- Deleting parent records leaves orphaned children or broken counts.
- Updates overwrite fields that were not present in the form.
- Concurrent edits cause lost updates.
- Duplicate submissions create duplicate records.

### State And Async

- Loading or error paths leave stale optimistic state.
- Query cache is not invalidated after mutation.
- Background jobs are not idempotent.
- Scheduled tasks double-process records.
- Retry logic repeats non-idempotent side effects.

### Navigation And Flow

- Create/update redirects to a route requiring data that was not created.
- Detail pages assume records exist and crash on deleted/missing data.
- Filters persist across unrelated contexts or vanish during pagination.
- Back/cancel returns to an unsafe or unrelated state.

### Time, Locale, And Files

- Timezone conversion shifts dates or deadlines.
- Date ranges are inclusive in one layer and exclusive in another.
- File size/type limits differ between UI, server, and storage.
- Generated filenames collide or expose private data.
- Locale formatting breaks parsing or sorting.

### External Integrations

- Webhooks lack signature checks or replay protection.
- Third-party API failures are swallowed as success.
- Timeout/retry handling can duplicate side effects.
- Integration response shape changes are not validated.

### Tests

- Tests cover only happy paths for critical flows.
- Tests mock away the layer where bugs usually occur.
- Assertions check status codes but not database/user-visible outcomes.
- Factories create impossible states that hide production defects.

## Confidence Checklist

Before reporting a bug, try to gather:

- File and line evidence for the faulty path.
- A user action sequence or API request to reproduce.
- The expected behavior from docs, tests, naming, validation, or surrounding patterns.
- The actual behavior from code, runtime, logs, or failing tests.
- A realistic data state that triggers the issue.
- A verification idea: test, command, browser step, or API call.
