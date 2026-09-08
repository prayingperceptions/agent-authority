# Authority Ops

**A professional AI agent that can act—but only inside explicit delegated authority.**

Authority Ops is a hackathon application for the **Agents for Humans Hackathon**. It uses the Strands Agents TypeScript SDK for the agent layer and an Agent Authority integration for identity, contracts, policy gates, and authority evidence.

## The demo

The agent processes vendor invoices and can request a simulated payment.

The key boundary is:

> **Proposal is not authorization. Authorization is not execution. Execution is not outcome.**

The contract gives the agent a **$1,000 delegated payment limit**:

- **$500 or less → ALLOW** and execute automatically
- **$501–$1,000 → ASK** and require human approval
- **Above $1,000 → DENY** and do not invoke the payment tool

| Invoice | Amount | Authority result | What happens |
| --- | ---: | --- | --- |
| INV-1041 | $480 | ALLOW | Simulated payment is submitted |
| INV-1042 | $800 | ASK → APPROVE | Human approval is recorded, then payment is submitted |
| INV-1043 | $8,400 | DENY | No payment execution is permitted |

The intentionally repetitive workflow makes the authority boundary visible instead of burying it in agent output.

## Architecture

```text
                        ┌──────────────────┐
                        │   Strands Agent  │
                        │  reason + tools  │
                        └────────┬─────────┘
                                 │ proposal
                                 ▼
                    ┌──────────────────────────┐
                    │     Agent Authority       │
                    │ Passport • Contract       │
                    │ Gate • Authority Score    │
                    └────────────┬─────────────┘
                                 │
                    ┌────────────┼────────────┐
                    ▼            ▼            ▼
                 ALLOW          ASK         DENY
                    │            │            │
                    ▼            ▼            ▼
                 execute      approval     blocked
                    │            │
                    │            ▼
                    │         approve
                    │            │
                    └──────┬─────┘
                           ▼
                       execute
                           │
                           ▼
                     Ledger receipt

Ledger chain:
REQUEST → EVIDENCE → PROPOSAL → AUTHORIZATION →
APPROVAL → EXECUTION ATTEMPT → DESTINATION → OUTCOME
```

## Run the deterministic demo

The deterministic demo requires only Node.js and TypeScript:

```bash
npm install
npm run demo
npm test
```

This path is designed to be repeatable for reviewers and does not require cloud credentials.

## Browser demo

Open `web/index.html` in a browser to show the three authority outcomes as a presentation UI. It is intentionally static so a reviewer can inspect and run it without a backend.

## Run the live Strands agent

The live path uses the Strands Agents TypeScript SDK and Amazon Bedrock. Current Strands TypeScript guidance requires Node.js 22+ and supports `Agent`, custom tools, and `BedrockModel`. Configure AWS credentials and model access before running the live path.

```bash
npm install
npm run build
export AWS_REGION=us-east-1
npm run live -- "Process invoice INV-1043. Read the invoice and request payment only if authorized."
```

The payment tool is deliberately authority-aware: the agent cannot bypass the gate by changing its own narrative.

## Why this matters

Professional agents are moving from producing text to operating systems, workflows, and business tools. The useful question is no longer only **"Can the model do this?"** It is also **"Was the agent authorized to do this, under which contract, and what evidence proves what happened?"**

Authority Ops demonstrates one concrete pattern for answering those questions without replacing the underlying agent framework.

## Security note

This is a hackathon reference application, not a production payment system or a hardened sandbox. The payment system is simulated. Agent Authority's security limitations and threat model remain applicable.

## License

MIT
