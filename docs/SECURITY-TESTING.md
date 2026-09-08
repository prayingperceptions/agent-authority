# Security Testing

Agent Authority is a developer-preview reference implementation. This document records the security-testing scope and known boundaries of the current release.

## Tested controls

The regression suite exercises:

- Passport signature verification and tamper detection
- Contract signature verification and tamper detection
- issuer and subject binding
- capability escalation rejection
- delegation non-escalation
- action-bound approval receipts
- approval signature and action-digest validation
- approval expiry and single-use replay protection
- Passport and Contract revocation checks
- Gate allow / ask / deny behavior
- Box policy checks and timeout handling
- Ledger evidence generation

The red-team suite is intended to prevent regressions in these controls. It is not a substitute for an independent security assessment.

## Known security boundaries

### AgentBox

The current Box implementation is a policy-aware disposable execution workspace. It is **not a hardened sandbox** and should not be treated as a VM, container, or hostile-code isolation boundary.

For untrusted code, place the executor behind an appropriate OS, container, or VM isolation layer and enforce resource, filesystem, network, and credential boundaries there.

### Revocation and replay state

The reference implementation provides revocation and single-use approval tracking locally. Production deployments should use durable, authenticated shared state appropriate to their trust and availability requirements.

### Key management

The reference implementation demonstrates cryptographic signing and verification. Production deployments should establish secure key storage, rotation, issuer trust, and compromise recovery procedures.

### Integrator authentication

The Gate evaluates the authority presented to it. Integrators are responsible for authenticating the agent and establishing trust in the Passport issuer before invoking policy evaluation.

## Reporting a vulnerability

Please see [`SECURITY.md`](../SECURITY.md) for responsible disclosure instructions.

Do not publish credentials, private keys, tokens, customer data, or other sensitive material in an issue.
