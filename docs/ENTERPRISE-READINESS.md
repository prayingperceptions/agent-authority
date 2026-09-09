# Enterprise Readiness Profile

Agent Authority is designed so enterprise deployments can keep authority enforcement outside the model and inside application infrastructure.

This document defines the minimum production baseline for an enterprise deployment. It is intentionally stricter than the local reference implementation.

## Enterprise deployment principles

1. **Explicit identity** — workforce and machine identities are established through enterprise identity providers and signed agent credentials; the application does not trust agent-supplied identity claims by themselves.
2. **Least privilege** — contracts grant only the resources, actions, and constraints required for a task.
3. **Separation of duties** — agent execution, policy administration, and human approval are separate roles.
4. **Durable authorization state** — approvals, revocations, replay protection, and contract lifecycle state are stored durably and updated atomically.
5. **Independent policy enforcement** — authorization is evaluated outside the model and outside the agent's narrative.
6. **Cryptographic integrity** — contracts, approvals, and authority events are signed; receipts are hashed and exportable.
7. **Traceability** — every material decision has a correlation ID and an auditable evidence trail.
8. **Tenant isolation** — every object is scoped to an organization/tenant and cross-tenant access is denied by default.
9. **Secure key management** — issuer and signing keys are held in a managed KMS/HSM or an enterprise key service rather than source code or local files.
10. **Fail closed** — missing identity, expired authority, unavailable policy state, invalid signatures, or ambiguous authorization produce `deny` or `ask`, never implicit `allow`.

## Recommended production architecture

```text
Enterprise IdP / Workforce SSO
              |
              v
      Agent Authority API
              |
      +-------+--------+
      |                |
      v                v
Identity / JWKS     Policy Service
      |                |
      +-------+--------+
              |
              v
         Authority Gate
              |
   +----------+-----------+
   |          |           |
 ALLOW       ASK        DENY
   |          |           |
   v          v           v
Tool/Box   Approval UI   Block
   |          |
   +----+-----+
        v
 Durable Evidence Ledger
        |
        +--> SIEM / Audit Export
        +--> Object Storage / Archive

Durable state: PostgreSQL or equivalent transactional store
Keys: AWS KMS/HSM or enterprise key manager
Secrets: AWS Secrets Manager / enterprise secret manager
Observability: structured logs + metrics + traces
```

## Day-one controls

### Identity

- OIDC/SAML-backed workforce identity for administrators and approvers.
- Signed machine/agent identity with issuer trust rooted in enterprise configuration.
- JWKS rotation with key IDs (`kid`) and overlap windows.
- Short-lived credentials and explicit expiration.
- No long-lived private keys in repositories, images, or environment files.

### Authorization

- Versioned contracts and policy bundles.
- Explicit resource/action pairs and typed constraints.
- Human approval rules for defined risk classes.
- Revocation that takes effect immediately against durable state.
- Replay protection using nonces and atomic consumption.
- Destination/resource binding for high-impact actions.
- Default deny on missing or ambiguous policy data.

### Evidence

- Append-only authority events.
- Receipt hash and authority-event hash.
- Correlation IDs spanning request, proposal, authorization, approval, execution, destination, and outcome.
- Redaction metadata without storing unnecessary secrets or sensitive payloads.
- Export to enterprise SIEM/data lake.

### Multi-tenancy

- Tenant ID is mandatory on every contract, policy, approval, event, and receipt.
- Tenant context is derived from authenticated identity, never accepted from an untrusted agent field.
- Database constraints and authorization middleware enforce tenant boundaries.
- Separate keys, retention policies, and export destinations can be configured per tenant.

### Operations

- Infrastructure as code.
- Dependency pinning and automated vulnerability scanning.
- Signed releases and provenance/SBOM generation.
- CI gates for unit, integration, security, and policy regression tests.
- Backup, restore, and disaster-recovery procedures.
- Break-glass access with explicit expiry and mandatory evidence.

## Enterprise API profile

A production API should expose concepts such as:

- `POST /v1/agents`
- `POST /v1/contracts`
- `POST /v1/delegations`
- `POST /v1/check`
- `POST /v1/approvals`
- `POST /v1/revocations`
- `GET /v1/receipts/{receiptId}`
- `GET /v1/events`
- `GET /v1/policies/{policyId}/versions`

Every request should carry a correlation ID and authenticated tenant context.

## Storage profile

The current reference implementation uses in-memory state. Enterprise deployments must replace this with a transactional durable store.

Required properties:

- atomic approval consumption
- unique nonce enforcement
- revocation reads that are consistent with policy evaluation
- immutable event records
- point-in-time recovery
- encrypted storage
- retention controls

PostgreSQL is a straightforward default. DynamoDB or another transactional datastore can also satisfy the interface when designed for conditional writes and consistent reads.

## Key management profile

Production private keys should be generated and protected in KMS/HSM-backed infrastructure.

Recommended separation:

- issuer signing key
- agent identity signing key
- approval signer keys
- receipt/integrity keys where required

Key rotation must preserve verification of historical receipts.

## Enterprise threat model

Required adversarial tests include:

- identity substitution
- expired contract
- revoked contract
- replayed approval
- replayed action nonce
- constraint bypass
- amount substitution
- destination substitution
- cross-tenant object access
- policy version confusion
- stale authorization state
- issuer key rotation
- malformed signed envelopes
- unavailable policy/state backend

## Production readiness statement

This profile defines an enterprise-ready deployment target, not a claim that the current open-source reference implementation has completed independent certification or third-party security audit.

A customer deployment should complete its own threat modeling, penetration testing, key-management review, compliance assessment, and operational readiness review before authorizing high-impact production actions.
