# Launch Readiness

## Status

**Public developer preview / alpha.**

The reference implementation has passed the current local smoke and red-team suite. It is suitable to publish and invite developers to experiment with the protocol.

## Verified in the final audit

- Passport payload/signature binding
- trusted Contract issuer verification
- signed Delegation verification primitive
- least-privilege delegation checks
- action-bound approvals
- approval expiry
- one-time approval consumption
- Passport and Contract revocation hooks
- deterministic Authority Score
- Box default environment sanitization
- Box cwd containment check
- Box timeout cleanup
- Ledger evidence interoperability
- clean build and smoke tests
- repository secret/reference scan

## Not production-grade yet

- Box does not provide kernel-level isolation; use a hardened container or VM backend for hostile code.
- Revocation/replay state is in-memory by default; distributed deployments need a durable atomic store.
- Passport issuer trust is supplied separately from the self-signature possession proof.
- Full delegation-chain policy and remote trust discovery are future protocol work.
- There has not yet been an independent third-party security audit.

## Recommended launch language

> Agent Authority is an open-source reference implementation for giving AI agents portable identity, bounded authority, approvals, policy enforcement, and verifiable evidence.

Do not claim comprehensive security, compliance certification, hostile-code containment, or legal non-repudiation.
