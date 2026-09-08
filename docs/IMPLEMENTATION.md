# Implementation v0.1

## Protocol loop

```text
Passport -> Contract -> Gate -> Action Request -> Decision -> Audit Event
```

### Passport

A Passport binds `agentId` to a public key. It identifies the principal; it does not grant permission.

### Contract

A Contract binds an agent to a short-lived, task-scoped set of capabilities. Capabilities can include constraints such as `currency`, `tenant`, `environment`, or other application-defined fields.

### Gate

`AuthorityGate.check()` is the reference enforcement point. Integrations MUST evaluate before executing the side effect.

The initial decision set is:

- `allow`: execute.
- `deny`: do not execute.
- `ask`: pause and request approval.
- `simulate`: return a dry-run result without side effects.

### Audit

Every check can emit an `AuditEvent`, optionally signed by the Gate's audit key. This creates a tamper-evident record that can be persisted by the host application.

## Important semantics

### Least privilege

Delegation is monotonic. A child can only receive a subset of its parent's resources, actions, and constraints.

### Constraint safety

The reference implementation treats child constraints as a subset of parent constraints. Applications with richer semantics should define those semantics explicitly rather than silently broadening access.

### Approval

Approval is not an implementation detail of the UI. `ask` is a first-class protocol result so that a human approval system, another agent, or an organization policy engine can handle it.

### Simulation

`simulate` is a protocol-level decision intended for dry runs. An executor MUST NOT perform side effects when the final decision is `simulate`.

## Reference adapter contract

```ts
const result = gate.check(contract, request);

switch (result.decision) {
  case 'allow':
    return execute(request);
  case 'ask':
    return queueForApproval(result.event);
  case 'simulate':
    return dryRun(request);
  case 'deny':
    throw new Error(result.reasons.join('; '));
}
```

## Next build targets

1. Contract approval objects with expiry, approver, and signed approval receipt.
2. A compact action vocabulary for MCP and HTTP adapters.
3. Delegation chains with signed child Contracts.
4. Replay protection and nonce tracking for action requests.
5. Policy composition: organization policy + agent contract + tool policy.
6. Adapter packages for MCP and A2A.
7. A minimal Box adapter for isolated execution.
