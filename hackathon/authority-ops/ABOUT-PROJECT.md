# Authority Ops — About the Project

## What is Authority Ops?

Authority Ops is a professional AI agent for invoice processing and simulated payments. It is designed around a simple operational rule: an agent may propose an action, but the agent does not get to decide its own authority.

The agent processes invoices, proposes payment actions, and requests execution through an explicit authority layer. The authority contract defines what the agent may do, when human approval is required, and what must be blocked.

## Who is it for?

Authority Ops is designed for finance and operations teams that want to automate repetitive invoice work without giving an AI agent unrestricted permission to move money or operate business systems.

The demonstrated workflow uses three tiers:

- **$0–$500:** autonomous approval and simulated execution
- **$501–$1,000:** human approval required
- **Above $1,000:** denied before payment execution

## Why does it matter?

Traditional automation often focuses on whether a tool can perform an action. Agentic systems add a different problem: the model can reason about actions and choose tools dynamically.

Authority Ops makes the missing boundary explicit:

> **Proposal ≠ Authorization ≠ Execution ≠ Outcome**

The result is an agent workflow where permission is evaluated independently from model reasoning, execution occurs only after authorization, and the system records evidence of what was requested and what happened.

## How it works

1. A Strands agent reads and reasons about an invoice.
2. The application derives transaction-critical fields from trusted invoice state.
3. The proposed payment action is evaluated by an Agent Authority integration using Passport, Contract, Gate, and Authority Score concepts.
4. The gate returns **ALLOW**, **ASK**, or **DENY**.
5. Only an authorized action may reach the simulated payment executor.
6. The workflow records an evidence chain covering request, evidence, proposal, authorization, approval, execution attempt, destination, and outcome.

The implementation also includes regression tests for wrong-agent identity, authority-limit violations, invoice-context substitution, destination substitution, and action-digest integrity.

## What was built for the hackathon

Authority Ops is a new application built for the Agents for Humans Hackathon. It uses the existing open-source Agent Authority project as an authority-layer integration. The new application work includes the invoice workflow, Strands agent/tool integration, scenario data, browser UI, evidence-flow implementation, and red-team hardening.

The payment flow is simulated. This is a hackathon reference application, not a production payment system or a hardened financial execution environment.

## Built with

- **Strands Agents TypeScript SDK** — agent orchestration, tool use, and model-driven workflow
- **Amazon Bedrock** — model provider for the live agent path
- **TypeScript / Node.js 22+** — application runtime
- **Agent Authority** — identity, delegated contracts, policy gates, authority scoring, and signed/evidence-oriented authorization concepts
- **Zod** — TypeScript schema validation
- **HTML / CSS / JavaScript** — browser presentation interface
- **GitHub Actions** — automated build and deterministic demo/test workflow

## Track

**Professional Agents** — an agent intended to make repetitive, judgment-heavy professional work faster while keeping consequential actions inside explicit authority boundaries.

## License

MIT
