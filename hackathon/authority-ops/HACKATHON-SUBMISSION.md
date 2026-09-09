# Authority Ops — Submission Package

## One-line pitch

**Give a professional AI agent a permission slip—and make every attempted action prove what it was allowed to do.**

## Project title

Authority Ops

## Track

Professional Agents

## Submission description

### The problem

AI agents are increasingly capable of taking actions inside business workflows, but capability is not the same thing as authorization. In accounts payable, an agent may correctly identify an invoice and propose a payment while still having no authority to move that amount, use that destination, or act without human review.

Traditional demos often blur together what the model proposed, what the system permitted, what the tool executed, and what actually happened. That makes an agent difficult to trust.

### Who it is for

Authority Ops is designed for finance, operations, and IT teams that want AI agents to handle repetitive invoice workflows without giving those agents unrestricted transaction power.

### What it does

Authority Ops uses a Strands Agents TypeScript agent to process invoices and request simulated payments. Before execution, an explicit authority layer evaluates the action against the agent's identity and delegated contract.

The demo contract creates three visible outcomes:

- **$500 or less → ALLOW** — execute automatically.
- **$501–$1,000 → ASK** — require human approval.
- **Above $1,000 → DENY** — do not execute.

The payment adapter also binds transaction-critical fields—invoice ID, amount, vendor, currency, and destination—to trusted application state instead of accepting those fields from the model as authority-bearing input.

### Why it matters

The design makes a simple but important distinction explicit:

> **Proposal is not authorization. Authorization is not execution. Execution is not outcome.**

The resulting evidence chain records the causal path:

**REQUEST → EVIDENCE → PROPOSAL → AUTHORIZATION → APPROVAL → EXECUTION ATTEMPT → DESTINATION → OUTCOME**

That pattern can be applied to other professional agents that need bounded, reviewable action authority.

### What makes it different

Authority Ops does not replace the agent framework. Strands handles the agent loop, reasoning, and tool use. The authority layer sits at the action boundary and evaluates whether a proposed operation is permitted before the business tool runs.

The demo therefore focuses on the control point that is easy to miss in an agent architecture: the transition from **"the agent wants to do this"** to **"the system permits this exact action."**

### AWS / Strands implementation

The application is implemented in TypeScript with `@strands-agents/sdk` and includes a live Amazon Bedrock path using `BedrockModel`. A deterministic local path is also provided so judges can reproduce the core behavior without cloud credentials.

The project can be built and tested from `hackathon/authority-ops` with Node.js 22+.

### Demonstrated scenarios

| Invoice | Amount | Gate | Outcome |
| --- | ---: | --- | --- |
| INV-1041 | $480 | ALLOW | Simulated payment submitted |
| INV-1042 | $800 | ASK | Approval recorded, then simulated payment submitted |
| INV-1043 | $8,400 | DENY | Payment execution blocked |

### Security posture

This is a hackathon reference application. Payments are simulated; this is not a production payment system or hardened hostile-code sandbox. The red-team hardening is intentionally included to demonstrate that critical transaction fields must come from trusted business state rather than model-generated values.

## Demo video outline

Target runtime: **4:30–4:50**. Keep the final upload below the 5-minute maximum.

### 0:00–0:20 — Hook

Show INV-1043 at $8,400.

Say:

> "I gave this AI agent authority to approve payments up to $1,000. Now watch what happens when it encounters an $8,400 invoice."

### 0:20–0:50 — Problem

Show the architecture and the three authority tiers.

Say:

> "An agent can know what should happen and still not be authorized to do it. We separate proposal, authorization, execution, and outcome so the boundary is enforceable and observable."

### 0:50–1:20 — Architecture

Highlight:

**Strands Agent → Passport / Contract / Gate → business tool → Ledger**

Explain that the payment tool is downstream of the authority decision.

### 1:20–2:15 — ALLOW case

Run INV-1041 ($480).

Show:

**ALLOW → simulated execution → receipt**

Point out that the amount and destination are bound by trusted application state.

### 2:15–3:10 — ASK case

Run INV-1042 ($800).

Show:

**ASK → human approval → simulated execution → receipt**

Pause briefly on the approval record.

### 3:10–3:45 — DENY case

Run INV-1043 ($8,400).

Show:

**DENY → payment tool not invoked**

Say:

> "The agent can propose the payment. It cannot grant itself the authority to execute it."

### 3:45–4:20 — Red-team proof

Show the test output for:

- wrong agent identity
- trusted invoice amount binding
- destination substitution
- action digest integrity

Say:

> "We deliberately attacked the boundary during development. A caller cannot turn an $8,400 invoice into a $400 authorized transaction, and an authorized amount cannot be redirected to an unapproved destination."

### 4:20–4:45 — Close

Show the evidence chain.

Say:

> "Authority Ops demonstrates a reusable pattern for professional agents: give agents useful power, constrain that power explicitly, and leave evidence of what was requested, authorized, executed, and produced."

## Judge-facing proof points

### Technical Implementation

- Real Strands Agents TypeScript SDK integration.
- Amazon Bedrock live path plus deterministic local test path.
- Custom tools and an explicit action-authorization boundary.
- Regression tests for identity, authority limits, trusted invoice binding, destination substitution, and action digest integrity.

### Design

- One focused professional workflow.
- Three easy-to-understand authority outcomes.
- Browser presentation UI plus CLI demo.
- Evidence chain makes authorization state visible instead of hiding it in logs.

### Potential Impact

- Targets repetitive accounts-payable work.
- Demonstrates a concrete pattern for safe delegation instead of a generic chatbot.
- The authority model is intentionally independent of one business workflow.

### Creativity & Originality

- Treats the authorization boundary itself as a product surface.
- Makes the distinction between model proposal and executable authority visible.
- Adds a security-focused red-team story to the demo rather than only showing the happy path.

### Presentation

- Start with the $8,400 denial, not the architecture diagram.
- Keep the authority policy visible throughout the demo.
- Show all three outcomes end-to-end.
- End with evidence, not another model response.

## Final pre-submission checklist

- [ ] Devpost title: Authority Ops
- [ ] Track: Professional Agents
- [ ] Public repository URL added
- [ ] Repository shows an MIT license
- [ ] README present and install instructions tested
- [ ] Architecture diagram linked and visible
- [ ] Demo video is public and under 5 minutes
- [ ] Video demonstrates the working project and covers problem, audience, and importance
- [ ] AWS Builder ID entered
- [ ] Live demo link added, if stable
- [ ] Any pre-existing non-standard code/work disclosed
- [ ] No secrets, credentials, or private data in the repository
- [ ] Final submission submitted before September 14, 2026 at 5:00 PM PDT

## Optional bonus

The official rules allow up to **0.6 bonus points** for public AWS Builder blog posts describing the journey building and implementing AWS for the hackathon. Up to three pieces can contribute 0.2 each; the title must use **Agents for Humans**. 
