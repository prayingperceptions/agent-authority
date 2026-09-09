# Enterprise Control Plane

Agent Authority's enterprise control plane is designed to put identity, policy, approvals, tenant isolation, durable state, and audit at a service boundary outside the model.

## Production principles

- Tenant context is derived from authenticated identity, never an agent request.
- Policies are immutable and versioned.
- Contracts pin an exact policy version.
- Action nonces are single-use.
- Revocation and approval state are durable and atomic in production storage.
- `ASK` approvals enforce separation of duties and exact action binding.
- Missing or ambiguous security state fails closed.
- Every authorization decision carries a correlation ID and evidence record.

## Service profile

`POST /v1/policies` — create a draft policy

`POST /v1/policies/{policyId}/activate` — activate one immutable version

`POST /v1/contracts` — bind an agent to a policy version

`POST /v1/contracts/{contractId}/revoke` — revoke authority

`POST /v1/check` — evaluate an action

`POST /v1/approvals` — create an approval request for `ASK`

`POST /v1/approvals/{approvalId}/decide` — approve/reject with role and separation-of-duties checks

`GET /v1/receipts/{receiptId}` — retrieve evidence

## Deployment

The control plane is intended to run behind TLS termination and an API gateway/WAF, with enterprise OIDC or SAML-backed identity and a transactional durable store such as PostgreSQL or DynamoDB.

The portable Agent Authority core remains framework-neutral. An enterprise control plane adds operational governance around it rather than coupling authorization to a particular agent framework.

## Scope note

This document defines the enterprise deployment architecture and required controls. It is not an independent compliance certification, third-party audit, or guarantee for every regulated workload.