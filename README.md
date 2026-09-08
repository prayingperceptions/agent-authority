# Agent Authority 🛡️

**Open-source authority infrastructure for AI agents.**

> **Give every AI agent a permission slip.**

> **Passport = who the agent is. Contract = what it may do. Gate = what is allowed. Box = where it runs. Ledger = what happened.**

Agent Authority is a small, framework-neutral protocol and reference runtime for giving AI agents **portable identity, task-scoped authority, least-privilege delegation, approval receipts, policy enforcement, execution boundaries, and portable evidence**.

It is not another agent framework or chatbot. Bring your existing agent—from ordinary Python/TypeScript functions to MCP, LangGraph, CrewAI, or custom runtimes—and put authority around it.

---

## ⚡ Quick Start (3 minutes)

### 1. Clone

```bash
git clone https://github.com/prayingperceptions/agent-authority.git
cd agent-authority
```

### 2. Install

```bash
npm install
```

### 3. Build and test

```bash
npm test
```

### 4. Run the core demo

```bash
npm run demo
```

### 5. Run the Box + Ledger demo

```bash
npm run demo:ledger
```

No account. No API key. No model provider required.

---

## 🧭 What Is Agent Authority?

AI agents can increasingly read data, call tools, modify files, send messages, spend money, and delegate work. The hard question is no longer only **“Can the agent do this?”** but **“Who authorized this exact action, under what limits, and what evidence proves what happened?”**

Agent Authority makes those boundaries explicit and machine-checkable.

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
                    │   SHOULD?   │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │     BOX     │
                    │   WHERE?    │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │    LEDGER   │
                    │    WHAT?    │
                    └─────────────┘
```

The protocol is designed to compose with existing identity, authentication, tool, and agent-to-agent standards rather than replace them.

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

A Contract is a short-lived, task-scoped authority document.

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

Contracts can constrain resources, actions, inputs, and approval requirements.

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

No LLM is needed to decide the policy. The policy engine is deterministic and testable.

### Approval chain

```text
Action Request
     ↓
    ASK
     ↓
Approval Request
     ↓
Human / Policy Authority
     ↓
Signed Approval Receipt
     ↓
Verify exact action digest
     ↓
Execute
```

The approval is cryptographically bound to the exact requested action so a modified request cannot silently reuse an earlier approval.

---

## 📦 Box

Agent Box is the execution boundary around the Contract.

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

Every action passes through the authority Gate before the executor runs.

Box V0.1 also supports a disposable local workspace, execution timeouts, process execution, network-policy hooks, and Ledger evidence.

> **Important:** the current Box reference implementation is a policy-aware disposable execution workspace, not a hardened VM/container sandbox. Use a hardened isolation runtime before executing hostile or mutually untrusted code.

---

## 📊 Authority Score

The Authority Score is a deterministic **0–100** posture score for a Passport + Contract pair. It explains where an agent has broad or sensitive authority and which controls improve its posture.

```bash
node packages/cli/dist/index.js score passport.json contract.json
```

Example:

```text
Authority Score: 98/100 (A)

POSITIVE  Human approval boundary       +10
POSITIVE  Constrained capabilities       +8
POSITIVE  Expiring Passport               +5
```

The score is an explainable posture indicator, not a security certification. It only evaluates authority visible at the Passport/Contract boundary.

## 🧾 Open Agent Ledger

Agent Authority can produce portable receipt-compatible evidence bundles.

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

A receipt can capture tool usage, policy decisions, approval status, cost metadata, hashes, errors, and redaction metadata without storing secrets by default.

Run the integration demo:

```bash
npm run demo:ledger
```

This is deliberately an evidence layer. The Ledger does not grant authority.

---

## 🔐 Delegation

Agents can delegate only a subset of their authority.

```ts
canDelegate(parentCapabilities, childCapabilities)
```

The reference implementation blocks privilege escalation and rejects child constraints that widen the parent's authority.

This is the foundation for agent-to-agent workflows where one agent creates or commissions another without handing over the entire parent authority set.

---

## 🧩 Why This Exists

NIST is actively exploring identity and authorization practices for software and AI agents, highlighting the need to manage the risks that arise when agents receive access to data, tools, and applications. See the [NIST AI agent identity and authorization concept paper](https://csrc.nist.gov/pubs/other/2026/02/05/accelerating-the-adoption-of-software-and-ai-agent/ipd).

At the same time, the MCP ecosystem continues to evolve its authorization and security model, while observability platforms such as LangSmith already provide deep tracing, monitoring, evaluation, deployment, and governance capabilities.

The goal here is narrower:

> **Provide an open, portable authority primitive that says exactly what an agent may do, lets another system enforce it, and leaves behind evidence of the decision.**

---

## 📦 Installation

### Local workspace

Use the repository workspace while the packages are in developer preview:

```bash
npm install
npm run build
```

The package names are reserved for registry publication after the API stabilizes.

### Tests

```bash
npm test
```

---

## 🏗️ Repository Structure

```text
agent-authority/
├── README.md
├── CONTRIBUTING.md
├── CHANGELOG.md
├── package.json
├── schemas/
│   ├── passport.schema.json
│   ├── contract.schema.json
│   ├── delegation.schema.json
│   ├── approval-receipt.schema.json
│   └── ledger-receipt-v1.schema.json
├── packages/
│   ├── core/          # Passport, Contracts, Gate, delegation, approvals, Ledger bridge
│   ├── box/           # Contract-bound execution workspace
│   └── cli/           # CLI starter
├── examples/
│   ├── demo.ts
│   ├── gate-demo.ts
│   └── ledger-interop/
├── tests/
│   ├── core-smoke.mjs
│   ├── smoke.mjs
│   ├── box-smoke.mjs
│   └── red-team.mjs
└── docs/
    ├── PROTOCOL.md
    ├── IMPLEMENTATION.md
    └── THREAT_MODEL.md
```

---

## 🔌 Designed To Compose

Agent Authority should sit underneath agent frameworks and beside existing standards.

| Layer | Examples | Agent Authority role |
|---|---|---|
| Agent framework | LangGraph, CrewAI, custom | Orchestration stays outside |
| Tool protocol | MCP | Authorize tool actions |
| Agent-to-agent | A2A and similar | Constrain delegated authority |
| Identity | OAuth/OIDC, SPIFFE | Bind external identity to authority |
| Execution | containers, VMs, browser sandboxes | Box boundary |
| Evidence | Open Agent Ledger | Portable receipts |

---

## 💰 Commercial Path

The core should remain open and useful without a hosted service.

The likely paid layer is **operational convenience**, not “unlocking the protocol.”

### Free / Open Source

- Passport and Contract primitives
- Gate evaluation
- Delegation
- Approval receipts
- Ledger evidence format
- Local Box reference runtime
- Adapters and examples

### Paid later

- Hosted authority control plane
- Organization workspaces
- SSO / RBAC
- Centralized policy management
- Agent inventory
- Approval inbox
- Signed export / evidence retention
- Managed Box infrastructure
- Custom connectors
- White-label institutional deployments
- Support and implementation

This follows the market's existing willingness to pay for hosted agent infrastructure while preserving an open local-first core.

### A faster path to the first $100K

Do not wait for thousands of subscriptions.

Sell implementation around the open core:

```text
10 design partners × $5,000 = $50,000
5 institutional pilots × $10,000 = $50,000
```

Those are target economics, not forecasts. The product remains open; customers pay for deployment, integration, policy design, support, and managed infrastructure.

---

## 📣 Launch Strategy

The product should not launch as “another AI security platform.”

Launch around a simple developer problem:

> **What is my agent actually allowed to do?**

### Viral wedge

Build a free local or web-based **Agent Authority Scanner**:

```text
AGENT AUTHORITY SCORE

42 / 100

🔴 Shell access
🔴 Unlimited external writes
🟠 Email send
🟡 GitHub write
🟢 Read-only files

[ Generate a safer Contract ]
```

The scanner becomes the acquisition engine. The open-source protocol becomes the product developers keep.

### First-week campaign

1. Release the scanner + open-source core together.
2. Publish one-minute demos showing an agent being allowed, blocked, and asked for approval.
3. Invite developers to scan their agents and publish their authority score.
4. Ship ready-made MCP, LangGraph, CrewAI, and generic adapters.
5. Ask for one thing publicly: **wrap one agent and submit one receipt/policy example.**

Do not manufacture adoption numbers or call it launched until the public repository, package, and website actually exist.

---

## 🧪 Current Status

**v0.1.6 developer preview**

Working today:

- ✅ Ed25519 Passports
- ✅ task-scoped Contracts
- ✅ deterministic Gate evaluation
- ✅ allow / ask / deny / simulate
- ✅ least-privilege delegation
- ✅ signed Authority events
- ✅ action-bound approval receipts
- ✅ Ledger-compatible evidence bundles
- ✅ Contract-bound AgentBox execution workspace
- ✅ deterministic Authority Score with findings and grades
- ✅ local disposable workspace lifecycle
- ✅ process execution with timeout
- ✅ smoke tests for core + Box + Ledger
- ✅ red-team regression suite

Not production-hardened yet:

- ⏳ hardened VM/container isolation
- ⏳ production key management / rotation
- ⏳ full framework adapters
- ⏳ policy language versioning beyond the current primitives
- ⏳ multi-tenant control plane
- ⏳ hosted approval UX

---

## 🛡️ Security

The reference implementation is designed to fail closed at the authority boundary, but it is **not a complete security or compliance system**.

Read `docs/THREAT_MODEL.md` before using it for sensitive workloads.

Never put secrets into Contracts, action logs, receipts, or example fixtures.

The current Box implementation is not a hardened sandbox. For hostile code, add an OS/container/VM isolation layer before relying on it.

For security reports, see `SECURITY.md`.

---

## 🤝 Contributing

We want this to become infrastructure, not a closed product.

Good first contributions:

- MCP adapters
- LangGraph adapter
- CrewAI adapter
- policy examples
- approval UI
- Box backends for containers/VMs
- additional language SDKs
- conformance tests

See `CONTRIBUTING.md`.

---

## 💛 Support the Mission

Agent Authority is intended to remain open-source infrastructure.

Support can come through contributors, sponsors, paid implementation, hosted infrastructure, or institutional deployments.

> **Give agents power carefully. Give people evidence.**

---

## 📄 License

MIT

---

## References

- NIST: AI agent identity and authorization research
- Model Context Protocol: authorization and security specifications
