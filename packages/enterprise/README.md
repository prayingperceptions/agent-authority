# Agent Authority Enterprise

`agent-authority-enterprise` is the reference control-plane package for deploying Agent Authority behind an enterprise identity boundary.

## Runtime boundary

The HTTP service requires a tenant-bound OIDC/OAuth JWT and a configured JWKS endpoint. The production entrypoint reads:

- `AUTHORITY_JWT_ISSUER`
- `AUTHORITY_JWT_AUDIENCE`
- `AUTHORITY_JWKS_URI`
- `HOST` (optional, defaults to `0.0.0.0`)
- `PORT` (optional, defaults to `8080`)

Start it after building:

```bash
npm run build:enterprise
npm --workspace agent-authority-enterprise start
```

Unauthenticated health checks are available at `GET /healthz` and `GET /readyz`. Control-plane routes live under `/v1` and derive tenant context from the authenticated principal; clients do not choose the tenant in an authorization header or URL.

## Control-plane routes

`POST /v1/policies` registers an immutable draft policy version.

`POST /v1/policies/{policyId}/activate` activates a policy version and retires the previous active version for that tenant/policy.

`POST /v1/contracts` issues a task-scoped contract from an active policy version.

`POST /v1/check` evaluates a nonce-bound action against the tenant's contract and policy boundary.

`POST /v1/revocations/contract` revokes a contract for the authenticated tenant.

The service intentionally separates policy administration, contract administration, security administration, and agent authorization through role checks.

## Important production note

The reference HTTP service currently uses an in-process state object. For a distributed production deployment, use the PostgreSQL store (or another transactional durable implementation) and put the service behind enterprise networking, key management, observability, backup/DR, and organizational controls appropriate to the deployment.
