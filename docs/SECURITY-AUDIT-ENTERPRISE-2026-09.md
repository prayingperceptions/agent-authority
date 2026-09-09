# Enterprise Security Audit — 2026-09

## Scope

This review covered the enterprise control-plane additions on `main`:

- `packages/enterprise`
- tenant-scoped policy and contract lifecycle
- OIDC/JWT verification
- nonce replay protection
- revocation
- policy versioning
- authorization and approval boundaries
- PostgreSQL persistence adapter
- enterprise CI/security regression coverage

This is a source-level security audit and adversarial test design review performed against the repository implementation. It is **not** an independent third-party penetration test or certification.

## Executive result

The enterprise layer now has the structural controls expected for a production-oriented deployment path: authenticated tenant context, versioned policies, contract pinning, fail-closed authorization, single-use action nonces, revocation, separation-of-duties checks, and durable PostgreSQL primitives.

The review found and corrected issues during implementation rather than leaving them as known defects.

## Adversarial checks

| Test | Expected | Result |
| --- | --- | --- |
| Cross-tenant request context | deny | PASS |
| Nonce replay | deny | PASS |
| Destination substitution | deny | PASS |
| Expired contract | deny | PASS |
| Contract revocation | deny | PASS |
| Policy version overwrite | reject | PASS |
| Approval self-approval | reject | PASS |
| Missing/invalid JWT | reject | PASS |
| JWT issuer mismatch | reject | PASS |
| JWT audience mismatch | reject | PASS |
| JWT expiration | reject | PASS |
| Unknown JWKS `kid` | reject | PASS |
| Invalid JWT signature | reject | PASS |

## Important findings and fixes

### HIGH — mutable policy version

A previously created policy version must never be silently rewritten because contracts can pin a specific version. The enterprise policy store now treats `(tenant, policy, version)` as immutable and requires a separate explicit activation operation.

### HIGH — tenant context injection

An agent request must not be able to select another tenant. Enterprise APIs derive tenant identity from the authenticated principal and use tenant-scoped lookups and keys.

### HIGH — replayable action

A previously allowed request must not be reusable by replaying the same nonce. The enterprise store uses a tenant-scoped unique nonce and atomic consumption.

### HIGH — destination substitution

High-impact actions must bind the destination/resource into policy constraints. A changed destination fails the policy check.

### MEDIUM — approval self-approval

The same principal that requested an approval must not approve it. The approval service enforces role membership and separation of duties.

### MEDIUM — stale key material

JWKS material is cached for a bounded interval to avoid repeated network fetches. Production deployments should monitor key rotation and keep the cache policy aligned with the identity provider's rotation strategy.

## Residual risks

1. TLS termination, API gateway/WAF policy, rate limiting, DDoS controls, and network segmentation remain deployment responsibilities.
2. PostgreSQL high-availability, backup/restore, encryption-at-rest, and point-in-time recovery require deployment-specific configuration.
3. A production system should add signed release provenance/SBOM, dependency and container scanning, centralized SIEM export, metrics/traces, and alerting.
4. The current enterprise package is a reference control-plane implementation and has not received an independent external penetration test.
5. Regulated workloads still require organization-specific threat modeling, compliance review, and operational approval.

## Security position

The design intentionally keeps the security decision outside the model. The agent can propose an action; the enterprise control plane authenticates the principal, loads the tenant-scoped contract and exact policy version, consumes the action nonce, evaluates constraints, records the decision, and only then permits the integration to execute.
