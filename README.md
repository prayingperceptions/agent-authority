# Agent Authority 🛡️

**Open-source authority infrastructure for AI agents.**

> **Give every AI agent a permission slip.**

**Passport = who. Contract = may. Gate = allow. Box = where. Ledger = evidence.**

Agent Authority is a framework-neutral protocol and reference runtime for giving AI agents **portable identity, task-scoped authority, least-privilege delegation, approvals, policy enforcement, execution boundaries, and verifiable evidence**.

It is not an agent framework. Bring an existing agent or tool runtime and put explicit authority around it.

---

## ⚡ Quick Start

```bash
git clone https://github.com/prayingperceptions/agent-authority.git
cd agent-authority
npm install
npm test
npm run demo
```

Run the Box + Ledger example:

```bash
npm run demo:ledger
```

Run the Authority Score example:

```bash
npm run demo:score
```

No account, API key, or model provider is required for the local demos.

---

## 🧭 The Model

AI agents can read data, call tools, modify files, send messages, run code, and delegate work. The authority question is:

> **Who authorized this action, under what limits, and what evidence records the decision?**

```text
                    ┌─────────────┐
                    │   PASSPORT  │
                    │    WHO?     │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │   CONTRACT  │
                    │    MAY?     │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │     GATE    │
                    │   ALLOW?    │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │     BOX     │
                    │   WHERE?    │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │    LEDGER   │
                    │   EVIDENCE  │
                    └─────────────┘
```

The protocol is designed to compose with existing identity, authentication, tool, agent-to-agent, execution, and evidence systems.

---

## 🪪 Passport

A Passport gives an agent a portable cryptographic identity.

- Ed25519 public key
- Stable agent and Passport identifiers
- Issuer and subject
- Optional expiration
- Metadata

A Passport answers **who**. It does not grant authority by itself.

---

## 📜 Contract

A Contract is a task-scoped authority document.

```ts
const contract = createContract({
  subjectAgentId: passport.agentId,
  issuer: passport.issuer,
  purpose: 'Prepare a monthly report',
  expiresAt: '2099-01-01T00:00:00.000Z',
  capabilities: [
    { resource: 'files', actions: ['read'] },
    { resource: 'email', actions: ['send'] },
  ],
  approvals: {
    requiredFor: ['email:send']
  }
});
```

Contracts define the authority granted to an agent and can constrain resources, actions, inputs, expiration, and approvals.

---

## 🛡️ Gate

The Gate is the enforcement point.

```ts
const result = gate.check(contract, {
  agentId: passport.agentId,
  resource: 'email',
  action: 'send'
});

// allow | ask | deny | simulate
```

Policy evaluation is deterministic and does not require an LLM.

### Approval flow

```text
Action Request
     ↓
    ASK
     ↓
Approval Request
     ↓
Approval Authority
     ↓
Signed Approval Receipt
     ↓
Verify exact action + expiry + single-use state
     ↓
Execute
```

---

## 📦 Box

Agent Box is the Contract-aware execution workspace.

```ts
const box = new AgentBox({
  passport,
  contract,
  gate,
  agentName: 'research-agent',
  framework: 'generic'
});

const result = await box.runProcess('node', ['worker.js']);
```

Box provides a disposable local workspace, policy checks, process execution, timeout handling, network-policy hooks, and Ledger evidence.

> **Security boundary:** the current Box reference implementation is not a hardened VM/container sandbox. Do not use it as hostile-code isolation without adding a hardened execution boundary.

---

## 📊 Authority Score

The Authority Score is a deterministic **0–100 posture score** for a Passport + Contract pair. It explains broad or sensitive authority and identifies controls that improve the posture.

```bash
npm run demo:score
```

Example:

```text
Authority Score: 83/100 (B)

HIGH       External write capability
MEDIUM     Long-lived authority
POSITIVE   Human approval boundary
POSITIVE   Constrained capabilities
```

The score is an explainable posture indicator, not a security certification.

See [`docs/AUTHORITY-SCORE.md`](docs/AUTHORITY-SCORE.md).

---

## 🧾 Ledger Evidence

Agent Authority can emit portable receipt-compatible evidence.

```text
Passport
   ↓
Contract
   ↓
Gate decision
   ↓
Execution
   ↓
Signed authority event
   ↓
Ledger receipt
```

Evidence can capture policy decisions, approval status, action metadata, hashes, and errors without storing secrets by default.

Run the integration demo:

```bash
npm run demo:ledger
```

The evidence layer records what happened; it does not grant authority.

---

## 🔐 Delegation

Agents can delegate only a bounded subset of their authority.

```ts
canDelegate(parentCapabilities, childCapabilities)
```

The reference implementation rejects privilege escalation and child authority that exceeds the parent grant.

---

## 🧩 Designed To Compose

| Layer | Examples | Agent Authority role |
|---|---|---|
| Agent framework | LangGraph, CrewAI, custom | Orchestration stays outside |
| Tool protocol | MCP | Authorize tool actions |
| Agent-to-agent | A2A and similar | Constrain delegated authority |
| Identity | OAuth/OIDC, SPIFFE | Bind external identity to authority |
| Execution | containers, VMs, browser sandboxes | Box boundary |
| Evidence | receipt / ledger systems | Portable evidence |

---

## 🏗️ Repository Structure

```text
agent-authority/
├── README.md
├── CONTRIBUTING.md
├── CHANGELOG.md
├── SECURITY.md
├── LICENSE
├── package.json
├── schemas/
├── packages/
│   ├── core/
│   ├── box/
│   └── cli/
├── examples/
├── tests/
└── docs/
```

---

## 🧪 Current Status

**v0.1.6 — Developer Preview**

- Ed25519 Passports
- task-scoped Contracts
- deterministic Gate evaluation
- allow / ask / deny / simulate
- least-privilege delegation
- signed authority events
- action-bound approval receipts
- approval replay protection
- revocation state
- Ledger-compatible evidence bundles
- Contract-bound AgentBox workspace
- deterministic Authority Score
- process execution with timeout
- smoke and adversarial regression tests

Not production-hardened yet:

- hardened VM/container isolation
- production key management and rotation
- fully distributed revocation and replay state
- broad framework adapters
- hosted control plane

---

## 🛡️ Security

This is a developer-preview reference implementation, not a complete security or compliance system.

Read [`docs/THREAT_MODEL.md`](docs/THREAT_MODEL.md) and [`docs/SECURITY-TESTING.md`](docs/SECURITY-TESTING.md) before using it for sensitive workloads.

Never put secrets into Contracts, action logs, receipts, or example fixtures.

For hostile code, add a hardened OS/container/VM isolation layer before relying on Box.

For vulnerability reports, see [`SECURITY.md`](SECURITY.md).

---

## 🤝 Contributing

Useful contributions include:

- MCP adapters
- agent-to-agent adapters
- framework integrations
- policy examples
- approval interfaces
- hardened Box backends
- additional language SDKs
- conformance and attack tests

See [`CONTRIBUTING.md`](CONTRIBUTING.md).

---

## 📄 License

MIT
