# Authority Ops Architecture

## Components

### Strands Agent

The agent provides reasoning and tool selection. Its tools are ordinary application capabilities; the payment tool is not itself the security boundary.

### Agent Authority integration

The application creates an agent Passport and a time-bounded Contract. The Contract grants constrained `payments:create` capabilities for three outcomes: autonomous allow, human review, and deny above the delegated limit. Every payment request is converted into an action request and evaluated before execution.

### Ledger

The receipt intentionally distinguishes:

1. request
2. evidence
3. model proposal
4. authorization
5. human approval
6. execution attempt
7. destination
8. outcome

This prevents the common collapse of “the model proposed it” and “the system executed it” into a single event.

## Demonstrated threats

- wrong agent identity
- over-limit payment request
- missing capability
- approval boundary
- auditability of blocked actions

## Non-goals

- real payment movement
- generalized ERP integration
- kernel-level sandboxing
- production financial controls
