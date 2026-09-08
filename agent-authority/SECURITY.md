# Security Policy

Agent Authority is an early-stage reference implementation for agent identity and authority control.

## Current security posture

The project has an adversarial regression suite covering signature substitution, identity mismatch, Contract tampering, issuer trust, privilege escalation, delegation escalation, approval replay, request substitution, expiry, revocation, Box environment inheritance, and cwd escape.

## Important limitations

AgentBox v0.1 is a policy-aware disposable workspace, not a hardened sandbox. Kernel/container/VM isolation is required before running arbitrary hostile code.

The default authority state store is in-memory. A multi-process or distributed deployment needs a durable store with atomic replay consumption and revocation.

Passport self-signatures prove control of the Passport key. Trust in the Passport issuer is a separate concern and must be provided by the integrating system.

## Reporting

Please report vulnerabilities privately through GitHub Security Advisories when enabled for the repository. Do not disclose an exploitable issue publicly before maintainers have had an opportunity to investigate.

## Claims discipline

A valid signature proves integrity of the signed bytes; it does not prove the underlying claims were truthful. An authority receipt records an integration boundary; it does not prove an agent was safe.

The Authority Score is a deterministic posture indicator, not a certification.
