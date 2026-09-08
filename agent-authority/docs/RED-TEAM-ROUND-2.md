# Red Team Round 2

Date: 2026-09-07
Target: Agent Authority v0.1.6
Mode: local source audit + adversarial runtime tests

## Scope

Passport verification, signed Contract verification, approval receipts, replay protection, revocation, delegation, Box process execution, environment inheritance, working-directory escape, package/build integrity, repository hygiene.

## Results

| Test | Result |
|---|---|
| Passport payload tamper | PASS — rejected |
| Passport signature mismatch | PASS — rejected |
| Contract payload tamper | PASS — rejected |
| Contract issuer key mismatch | PASS — rejected |
| Capability escalation | PASS — rejected |
| Delegation escalation | PASS — rejected |
| Approval action substitution | PASS — rejected |
| Approval signature mismatch | PASS — rejected |
| Approval replay | PASS — second use rejected |
| Approval expiry | PASS — rejected |
| Passport revocation | PASS — fail-closed |
| Contract revocation | PASS — fail-closed |
| Box host environment leakage | PASS — default environment is sanitized |
| Box cwd escape | PASS — rejected |
| Timeout cleanup | PASS — process exits cleanly |
| forbidden assistant-reference scan | PASS — no matches |
| Secret marker scan | PASS — no matches |
| Clean-room TypeScript build | PASS with normal dependency install/symlink boundary |

## Findings fixed during round 2

1. Approval verification was stateless. Added one-time consumption through an `AuthorityStateStore`.
2. Passport verification did not require the presented Passport to equal the signed payload. It now checks canonical payload equality plus signature verification.
3. Contract verification had the same payload-substitution issue. It now checks canonical payload equality plus issuer signature verification.
4. Box inherited the host environment by default. It now starts with a minimal environment and accepts explicit variables.
5. Box allowed a configured working directory outside the workspace. It now rejects cwd escape.
6. Box timeout timers could remain alive after successful execution. The timer is now cleared in `finally`.
7. Box package imports briefly used monorepo-relative paths. Restored package-level dependency imports for installability.
8. Repository package versions were inconsistent. All project package versions are now 0.1.6.

## Remaining limitations

- The default Passport proof is a proof of possession of the Passport key; issuer trust is provided separately.
- The default state store is in-memory. A distributed deployment needs a durable, atomic replay/revocation store.
- AgentBox is not a hardened VM/container sandbox.
- Network and filesystem adapters enforce policy at the integration boundary; they are not kernel-level controls.
- Delegation signatures exist as primitives, but a full trusted delegation registry and remote revocation protocol are future work.

## Release posture

**Developer Preview / Alpha.** Suitable for public experimentation and protocol development. Not suitable to market as a complete security boundary for arbitrary hostile code.
