# Enterprise production deployment

The enterprise package has two runtime modes:

- `InMemoryEnterpriseStore` for tests and local development.
- `PostgresEnterpriseStore` for production deployments.

The production entrypoint requires PostgreSQL and OIDC/JWKS configuration.

## Required environment

Copy `packages/enterprise/.env.example` and provide real values through your deployment secret/configuration system. Do not commit credentials.

Required:

- `DATABASE_URL`
- `AUTHORITY_JWT_ISSUER`
- `AUTHORITY_JWT_AUDIENCE`
- `AUTHORITY_JWKS_URI`

The service listens on port `8080` by default.

## Database

Apply `packages/enterprise/migrations/001_enterprise.sql` through the organization's migration process. The runtime also performs an idempotent schema initialization so a reference deployment can bootstrap itself, but mature production environments should treat migrations as the authoritative schema lifecycle.

Use a PostgreSQL deployment with encryption in transit, encryption at rest, automated backups, point-in-time recovery, monitoring, and a documented recovery procedure.

## Network

Terminate TLS at the managed load balancer or ingress layer. Restrict network access so the authorization service and database are reachable only from trusted application paths. Put rate limiting and request-size limits at the edge as well as the service.

## Identity

Use short-lived OIDC access tokens. Validate issuer, audience, signature, expiration, not-before, algorithm, and signing key identifier. Tenant identity comes from the authenticated principal rather than a client-selected routing value.

## Authorization

Keep policy administration, contract administration, security administration, and approval authority separated organizationally where practical. A human approval must bind to the exact action digest and must not be issued by the requester.

## Operations

Export authorization events and receipts to the organization's audit/SIEM pipeline. Monitor denied actions, repeated nonce failures, approval failures, authentication failures, and database health. Protect signing keys with KMS/HSM-backed systems when deployment architecture requires server-managed signing keys.

## Security assessment

Before allowing high-impact financial, production, destructive, or privileged actions, run an independent application and infrastructure security assessment against the deployed service. The repository's red-team tests are regression tests, not a substitute for an external assessment.
