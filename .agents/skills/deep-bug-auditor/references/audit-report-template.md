# Deep Bug Audit Report Template

Use this template for formal audits or when the user asks for a written report.

```markdown
# Deep Bug Audit

## Scope

- App/codebase:
- Date:
- Areas inspected:
- Runtime verification:
- Test suites inspected/run:
- Limitations:

## System And Flow Map

| Flow | Role | Entry | Key Code Paths | Data Mutations | Failure States |
|---|---|---|---|---|---|
|  |  |  |  |  |  |

## Findings

### 1. [Severity | Confidence] Title

- Affected flow:
- Reproduction path:
- Expected:
- Actual:
- Evidence:
- Root cause:
- User/data impact:
- Suggested fix:
- Suggested regression test:

## Test Gaps

- Gap:
- Why it matters:
- Suggested test:

## Recommended Fix Order

1. 
2. 
3. 

## Verification Notes

- Ran:
- Inspected:
- Could not verify:
```
