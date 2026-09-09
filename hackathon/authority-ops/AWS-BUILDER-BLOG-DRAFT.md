# Agents for Humans: Building an Authority-Aware Professional Agent with Strands Agents

## Working thesis

AI agents are good at proposing actions. Professional software needs a separate answer to a harder question: **is this exact action authorized?**

For the Agents for Humans Hackathon, Authority Ops explores that boundary in a concrete accounts-payable workflow using Strands Agents for the agent layer and an explicit delegated-authority layer for transaction control.

## The use case

Imagine a finance team that wants an AI agent to process routine vendor invoices.

The agent should be able to read an invoice, identify the vendor and amount, and request a payment. But the organization does not want the model to decide its own authority.

Our demo contract therefore defines three tiers:

- $500 or less: autonomous execution
- $501–$1,000: human review
- above $1,000: deny

This turns an abstract safety principle into a visible business rule.

## Why Strands Agents

The application is implemented in TypeScript using the Strands Agents SDK. Strands provides the agent loop, model interaction, and custom tool mechanism; the authority layer remains an explicit application boundary around the business action.

The important architectural choice is that the payment capability is not trusted merely because the model selected a tool. The application constructs the payment request from trusted invoice state and then asks the authority gate to evaluate that exact request.

## The security lesson

During development we deliberately tested an obvious failure mode: could an untrusted caller change the invoice amount and turn an $8,400 invoice into a $400 authorized payment?

The first implementation exposed this weakness because the tool accepted an agent-supplied transaction amount.

We hardened the flow so the payment request is derived from trusted application state using the invoice ID supplied to the tool. The same principle applies to vendor, currency, invoice ID, and destination.

We also tested destination substitution: an authorized payment must not become authorized merely because its destination changes.

The result is a stronger boundary:

**model proposal → trusted application state → authorization decision → execution**

## Evidence, not just logs

The demo records a causal evidence chain:

**REQUEST → EVIDENCE → PROPOSAL → AUTHORIZATION → APPROVAL → EXECUTION ATTEMPT → DESTINATION → OUTCOME**

This distinction matters because a model response saying "pay the invoice" is not proof that an authorized payment happened.

## What the demo shows

1. A $480 invoice is allowed and submitted to the simulated payment system.
2. An $800 invoice enters the human-approval path and is submitted after approval.
3. An $8,400 invoice is denied before payment execution.
4. Red-team tests verify identity binding, amount binding, destination binding, and digest integrity.

## What comes next

The hackathon application is deliberately small. A production system would need durable state, stronger issuer trust, real human-approval infrastructure, hardened runtime isolation, real financial controls, and independent security review.

The architectural idea is the part worth carrying forward: **an agent should not be its own authority boundary.**

## Suggested closing

Strands makes it easy to build an agent that can reason and act. Authority Ops asks what should happen one layer later:

> When the agent proposes an action, what proves it was allowed to perform that exact action?

That is the boundary we built and tested for this hackathon.
