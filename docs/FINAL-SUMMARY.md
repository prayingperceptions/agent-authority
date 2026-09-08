# Agent Authority — Final Summary

Release: 0.1.6 Developer Preview
Owner/repo target: `prayingperceptions/agent-authority`

## What it is

An open-source reference implementation for portable agent identity, task-scoped authority contracts, policy enforcement, approvals, bounded delegation, authority posture scoring, execution boundaries, and verifiable evidence.

## Core model

Passport = who the agent is.

Contract = what authority was granted.

Gate = whether a requested action is allowed.

Box = where execution occurs.

Ledger = what happened.

## Final security posture

The project passed the current adversarial test suite for its developer-preview threat model.

It is not yet a production security boundary for arbitrary hostile code.

## Verified controls

- signed Passport payload binding
- trusted Contract issuer verification
- signed Delegation verification primitive
- least-privilege delegation checks
- exact-action approval binding
- approval expiry
- one-time approval consumption
- Passport and Contract revocation hooks
- sanitized Box process environment
- Box workspace cwd containment
- timeout cleanup
- deterministic Authority Score
- Ledger evidence interoperability

## Residual risks

- Box is not a hardened VM/container sandbox.
- Replay/revocation state is in-memory by default.
- Passport issuer trust discovery is external to the core possession proof.
- Full delegation-chain enforcement and remote trust discovery remain future work.
- No third-party security audit has been completed.

## Launch decision

**Ship publicly as a Developer Preview / Alpha.**

Market the problem and the protocol. Do not market the project as complete agent security or compliance certification.
