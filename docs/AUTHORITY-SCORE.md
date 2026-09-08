# Authority Score

Authority Score is a deterministic 0–100 assessment of the authority granted by a Passport + Contract pair.

It is a posture indicator, not a safety certification. The score explains which contract properties increase or decrease exposure so developers can harden authority before execution.

## Signals

The v0.1 scoring model considers process execution, unrestricted network access, financial authority, external writes, approval boundaries, contract lifetime, capability breadth, capability constraints, and Passport expiration.

The score is intentionally explainable. Every point change has a named finding and rationale.

## Example

```ts
import { calculateAuthorityScore } from '@jubileelabs/agent-authority-core';

const result = calculateAuthorityScore({ passport, contract });
console.log(result.score, result.grade);
console.log(result.findings);
```

## Important limitation

The score only evaluates authority visible at the Passport/Contract boundary. It does not prove that an implementation, tool, host, model, operating system, or external service is safe.
