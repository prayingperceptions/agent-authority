# Release Audit

## Current status

**Release candidate for public developer preview.**

## Verification

- TypeScript build: PASS
- Core smoke: PASS
- Approval/Ledger smoke: PASS
- Box smoke: PASS
- Red-team suite: PASS
- Demo process exits: PASS
- Ledger demo exits: PASS
- Repository secret/reference scan: CLEAN
- Source archive excludes `node_modules`, build output, receipts, and `.git`

## Launch blockers for a production security claim

- Hardened container/VM Box backend
- Durable replay/revocation store
- Formal issuer trust model and key rotation
- Full signed delegation-chain enforcement
- Independent security review
- Fuzz/property testing of canonicalization, schemas, and policy matching
- Published package provenance and release automation

## Public launch recommendation

Launch with the words **developer preview**, **reference implementation**, and **protocol under active development**.

Do not claim complete security, compliance certification, hostile-code isolation, or legal non-repudiation.
