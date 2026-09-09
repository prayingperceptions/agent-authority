# Enterprise next steps

Agent Authority's enterprise service is now part of `main`.

## Production boundary

The reference HTTP service is intentionally small. A production deployment should use a transactional durable store for policies, contracts, revocation state, nonces, approvals, and authorization events. The process-memory implementation is for tests and local development.

## Required controls before production

- Durable transactional authorization state
- Single-use request nonces enforced atomically
- Tenant-bound OIDC/JWKS authentication
- Versioned immutable policies
- Task-scoped contracts pinned to policy versions
- Separate policy, contract, security, and approval administration
- Approval records bound to the exact action digest
- Durable authorization and outcome receipts
- Structured audit export / SIEM integration
- KMS/HSM-backed key management where signing keys are used
- Backups, point-in-time recovery, retention, and disaster recovery
- TLS termination and enterprise network controls
- Rate limiting and abuse protection at the deployment edge
- Independent security assessment before handling high-impact production actions

## Git branch policy

Protect `main` with pull requests, required CI checks, conversation resolution, and no force pushes. A single-maintainer project can defer the two-reviewer requirement until there is a genuine second reviewer.
