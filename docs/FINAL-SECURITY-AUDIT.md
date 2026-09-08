# Final Security Audit

Date: 2026-09-07
Release: 0.1.6
Reviewer mode: adversarial local code and runtime testing

## Executive result

**PASS for public developer-preview release. FAIL for a production-security claim.**

The second red-team cycle found and fixed substantive issues in approval replay, signed-payload substitution, Box environment inheritance, Box cwd escape, and timeout cleanup. The final regression suite passes.

## Attack families exercised

### Identity
- altered Passport fields around a valid signature
- mismatched Passport signing key
- request agent ID mismatch
- Contract subject mismatch

### Authority
- capability escalation
- altered signed Contract capabilities
- issuer key substitution
- delegation escalation

### Approval
- action/input substitution
- altered approval payload
- signer mismatch
- missing signer/public-key pair
- expired approval
- replay of a consumed approval

### Lifecycle
- Passport revocation
- Contract revocation

### Box
- host environment leakage
- working-directory escape
- execution timeout cleanup

### Repository/supply-chain hygiene
- forbidden assistant-reference scan
- private-key/API-key marker scan
- dangerous dynamic-code API scan
- package metadata and version consistency
- packed core package contents

## Final findings

### Resolved

**Critical — approval replay:** fixed with one-time approval consumption.

**High — signed-payload substitution:** fixed by requiring canonical payload equality before accepting a Passport or Contract signature.

**High — ambient Box environment:** fixed by using a minimal environment by default.

**High — Box cwd escape:** fixed by requiring the process working directory to remain inside the Box workspace.

**Medium — timeout handle:** fixed by clearing the timer in `finally`.

### Accepted residual risks

**High — Box isolation:** local Box is not a hardened sandbox. This is documented and is a deliberate v0.1 limitation.

**Medium/High — distributed replay/revocation:** default state is in-memory. Production deployments must provide durable atomic state.

**Medium — issuer trust discovery:** trust roots are supplied by the caller rather than through a standardized discovery/PKI layer.

**Medium — delegation chain:** signed delegation is implemented as a primitive; complete chain validation and remote revocation remain future work.

## Release decision

Publish as **0.1.6 Developer Preview**.

Before any production-security positioning, add a hardened Box backend, durable authority state, key rotation/trust-root guidance, full delegation-chain enforcement, fuzz/property tests, and independent security review.
