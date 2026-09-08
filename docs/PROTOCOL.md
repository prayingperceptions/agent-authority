# Agent Authority Protocol v0.1

## Goal

Agent Authority is a small open protocol for establishing **who an agent is** and **what authority it has for a specific task**.

It intentionally separates four concerns:

1. **Passport** — durable agent identity and public key.
2. **Contract** — bounded authority for a particular task.
3. **Gate** — runtime enforcement point that evaluates proposed actions.
4. **Box** — optional isolated execution environment.

The core protocol does not require a cloud service.

## Passport

A Passport identifies an agent and binds it to an Ed25519 public key. It is not an access token and does not grant arbitrary authority.

Required fields:

- `version`
- `passportId`
- `agentId`
- `issuer`
- `subject`
- `createdAt`
- `publicKeyJwk`

## Contract

A Contract is a signed or otherwise authenticated authority document for a task. Capabilities use a simple resource/action model.

A capability is:

```json
{"resource":"github","actions":["read","write"],"decision":"allow"}
```

The initial decisions are:

- `allow`
- `deny`
- `ask`
- `simulate`

Contracts should be short-lived and task-scoped.

## Delegation

Delegation must be monotonic: a child agent can receive only authority that is a subset of the delegator's authority. No child may amplify its parent's capabilities.

The v0.1 library implements this as set intersection over resource/action capabilities.

## Enforcement

The Gate evaluates every tool or side-effect request against the contract. The minimum decision model is:

```text
request -> identify agent -> validate contract -> match capability -> decision
```

No request should bypass the Gate merely because the agent has a valid Passport.

## Relationship to existing standards

Agent Authority should compose with, rather than replace, current standards:

- **MCP** for tool interoperability and OAuth-based transport authorization.
- **A2A** for agent-to-agent communication and Agent Cards.
- **SPIFFE/SPIRE** when workload identity is already available at the infrastructure layer.
- **OAuth 2.x / OIDC** for human and service authentication.

Agent Authority adds a task-level authority contract and explicit delegation semantics above those primitives.

## Non-goals for v0.1

- Acting as a certificate authority.
- Replacing OAuth.
- Replacing SPIFFE.
- Running containers or VMs.
- Holding user funds.
- Being an agent framework.
- Defining a proprietary model or LLM API.


## Approval receipts

An `ask` decision creates an approval request bound to the exact action digest and audit event. A human or authorized policy actor can issue an immutable approval or rejection receipt. The receipt never overwrites the original event. Consumers must verify that the receipt matches the original event, contract, agent, and action digest before treating the approval as valid.

Approval flow:

```text
ASK -> ApprovalRequest -> human/policy decision -> ApprovalReceipt -> verify -> execute
```


## Evidence / Ledger integration

Agent Authority emits decision and approval events that can be consumed by a separate local-first ledger. The ledger may render, persist, redact, hash, and export those events, but it must not become the authority source. Authority remains in the Passport, Contract, Delegation, Gate, and ApprovalReceipt primitives.
