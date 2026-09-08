# Jubilee Agent Integration

This package is designed to sit underneath `jubilee-agent` rather than replace its Triune/Angel architecture.

## Recommended placement

```text
Jubilee OS
├── Mind / Prophet / Will
├── Angel dispatch + tools
├── Model adapters
└── Agent Authority
    ├── Passport        → agent identity
    ├── Contract        → task authority
    ├── Gate            → action decision
    ├── Box             → execution boundary
    └── Ledger bridge   → portable evidence
```

## First integration target

Create one Authority Contract when a Jubilee task is dispatched.

```ts
const contract = createContract({
  subjectAgentId: agent.passport.agentId,
  issuer: 'jubilee-agent',
  purpose: task.mission,
  expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(),
  capabilities: deriveCapabilitiesForAngel(task, angel),
});
```

Then require every side-effecting tool call to pass through the Gate.

```ts
const decision = gate.check(contract, {
  agentId: agent.passport.agentId,
  resource: tool.resource,
  action: tool.action,
  input: safeToolMetadata,
});

if (decision.decision === 'deny') throw new Error(decision.reasons.join('; '));
if (decision.decision === 'ask') return requestHumanApproval(decision.event);
```

## Box integration

Use `AgentBox` around code-execution and tool-running workloads.

```ts
const box = new AgentBox({
  passport,
  contract,
  gate,
  agentName: angel.name,
  framework: 'jubilee-agent',
});

await box.runProcess('bun', ['test']);
```

Later, replace the local workspace with a hardened container or VM backend without changing the Contract API.

## Ledger integration

Every Gate decision and Box execution can produce an Open Agent Ledger-compatible receipt. Keep the Ledger downstream of authority enforcement.

## Important

Do not grant the Will or any Angel a broad “all tools” Contract. Capabilities should be derived from the actual mission and narrowed when an Angel delegates to another Angel.
