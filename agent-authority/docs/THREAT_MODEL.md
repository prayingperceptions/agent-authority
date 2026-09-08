# Threat model v0.1

## Protected assets

- Agent identity keys
- Contracts and their signatures
- Delegation authority
- Tool-side effects
- Audit/provenance records

## Threats

### Identity spoofing
An attacker claims to be another agent.

**Mitigation:** signed Passport identity and public-key verification.

### Authority escalation
A child agent attempts to obtain capabilities not present in its parent authority.

**Mitigation:** monotonic delegation; child capabilities must be a subset of parent capabilities.

### Contract tampering
A contract is modified after authorization.

**Mitigation:** canonical serialization + signature verification.

### Replay
An attacker replays an old delegation or action authorization.

**Mitigation planned:** nonce tracking, explicit not-before/expiry checks, and optional action IDs in v0.2.

### Confused deputy
A valid agent is tricked into using its authority for the wrong task.

**Mitigation:** task-scoped Contract with explicit purpose; Gate should bind request context to contract and require step-up approval for high-risk operations.

### Over-broad resources
A capability such as `filesystem:*` grants more than intended.

**Mitigation planned:** structured resource identifiers and constraints in v0.2; avoid wildcard semantics until standardized.

### Key compromise
An agent's private key is stolen.

**Mitigation planned:** short-lived credentials, key rotation, revocation/status, and optional hardware-backed keys.

## Security principle

**Authentication is not authority. Authority is not execution. Execution is not evidence.**

Those boundaries must remain explicit in the protocol.
