# Open Agent Ledger integration

Open Agent Ledger is the evidence layer for Agent Authority. Authority remains the source of permission; Ledger records what the authority boundary observed and makes that evidence portable.

## Boundary

| Concern | Agent Authority | Open Agent Ledger |
|---|---|---|
| Agent identity | Passport | references `passport_id` |
| Task authority | Contract | records applicable contract/event IDs |
| Delegation | Delegation | records evidence references |
| Enforcement | Gate | records decision |
| Approval | ApprovalRequest / ApprovalReceipt | preserves approval evidence |
| Execution evidence | authority event | receipt, timeline, cost, tool usage, redaction |

## Event boundary

```text
Passport + Contract
        |
        v
      Gate
        |
        +---- decision event -------------------+
        |                                        |
        |                                        v
        |                              Open Agent Ledger
        |                                        |
        |                                        v
        |                               portable receipt
        |
        +---- ASK -> ApprovalRequest -> ApprovalReceipt
                             |
                             v
                           Gate
                             |
                             v
                         execution
                             |
                             v
                           Ledger
```

## Shared identifiers

The mapping preserves these identifiers without reinterpretation:

- `agentId` -> `agent.agent_id`
- `passportId` -> `agent.passport_id`
- `contractId` -> policy/evidence metadata
- `eventId` -> `policy.decisions[].event_id`
- `approvalId` -> approval evidence
- `actionDigest` -> approval evidence
- decision -> `policy.decisions[].decision`
- timestamp -> `run.start_time` / `run.end_time`

## API

The core package exposes:

```ts
authorityEventToLedgerReceipt(options)
createLedgerEvidenceBundle(options)
verifyLedgerReceipt(receipt)
```

A bundle can preserve the signed Authority event and signed Approval Receipt alongside the `receipt-v1` artifact.

## Important rule

The Ledger receipt never grants authority. A Gate decision and valid Contract remain authoritative. Receipt hashes provide tamper evidence for the serialized artifact; they do not prove that the observed data was truthful or that an agent was safe.

## Demo

```bash
npm run demo:ledger
```

The demo writes `.agent-authority/receipts/ledger-evidence.json` and verifies:

1. the receipt hash;
2. the signed authority event;
3. the signed approval receipt.

## Future AgentBox integration

AgentBox can emit the same authority and ledger events around sandbox creation, network policy, filesystem access, tool execution, snapshots, and rollback. This preserves the protocol boundary: Box supplies isolation, Gate supplies authority enforcement, Ledger supplies evidence.
