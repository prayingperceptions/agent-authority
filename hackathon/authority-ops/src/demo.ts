import { createHash } from 'node:crypto';
import { AgentAuthorityAdapter, authorityScore, buildContract } from './authority.js';
import { makeReceipt, printReceipt, type LedgerEvent } from './ledger.js';
import { checkInvoicePolicy } from './policy.js';
import type { AgentPassport, Invoice, ToolInvocation } from './domain.js';

const agentId = 'agent_ap_ops';
const passport: AgentPassport = {
  version: '0.1', passportId: 'passport_demo_ap_ops', agentId, issuer: 'authority-ops-demo',
  expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
};
const contract = buildContract(agentId, 1000);
const authority = new AgentAuthorityAdapter(passport, contract);

const invoices: Invoice[] = [
  { invoiceId: 'INV-1041', vendorId: 'V-021', vendorName: 'Northwind Industrial', amount: 480, currency: 'USD', description: 'Maintenance supplies', source: 'ap:inbox/INV-1041.pdf' },
  { invoiceId: 'INV-1042', vendorId: 'V-021', vendorName: 'Northwind Industrial', amount: 800, currency: 'USD', description: 'Quarterly service renewal', source: 'ap:inbox/INV-1042.pdf' },
  { invoiceId: 'INV-1043', vendorId: 'V-021', vendorName: 'Northwind Industrial', amount: 8400, currency: 'USD', description: 'Emergency equipment replacement', source: 'ap:inbox/INV-1043.pdf' },
];

function digest(value: unknown): string {
  const canonicalize = (v: unknown): string => {
    if (v === null || typeof v !== 'object') return JSON.stringify(v);
    if (Array.isArray(v)) return `[${v.map(canonicalize).join(',')}]`;
    const record = v as Record<string, unknown>;
    return `{${Object.keys(record).sort().map(k => `${JSON.stringify(k)}:${canonicalize(record[k])}`).join(',')}}`;
  };
  return createHash('sha256').update(canonicalize(value), 'utf8').digest('hex');
}

function approvePayment(args: {
  event: { decision: string; actionDigest: string };
  request: { agentId: string; resource: string; action: string; input?: Record<string, unknown> };
  approver: string;
}): { approved: boolean; reason: string; approvalId: string } {
  const amount = args.request.input?.amount;
  const expectedDigest = digest(args.request);
  if (args.event.decision !== 'ask') return { approved: false, reason: 'Approval is only valid for ASK decisions.', approvalId: 'none' };
  if (expectedDigest !== args.event.actionDigest) return { approved: false, reason: 'Approval does not match the exact authorized action.', approvalId: 'none' };
  if (args.request.agentId !== agentId || args.request.resource !== 'payments' || args.request.action !== 'create') {
    return { approved: false, reason: 'Approval target does not match the payment action.', approvalId: 'none' };
  }
  if (typeof amount !== 'number' || amount <= 500 || amount > 1000) {
    return { approved: false, reason: 'Approval amount is outside the human-review tier.', approvalId: 'none' };
  }
  return { approved: true, reason: `Approved by ${args.approver} for this exact action.`, approvalId: `approval_${args.event.actionDigest.slice(0, 12)}` };
}

console.log('AUTHORITY OPS');
console.log('Professional invoice agent + delegated authority demo');
console.log(`Authority Score: ${authorityScore(contract)}/100`);
console.log('Delegated payment limit: $1,000 USD');
console.log('Autonomous: ≤ $500 | Human approval: $501–$1,000 | Deny: > $1,000');

for (const invoice of invoices) {
  console.log('\n══════════════════════════════════════════');
  console.log(`INVOICE ${invoice.invoiceId}  ${invoice.vendorName}  $${invoice.amount.toLocaleString()}`);
  console.log('──────────────────────────────────────────');
  console.log(`Policy: ${checkInvoicePolicy(invoice).reason}`);

  const proposal = {
    action: 'payments:create', invoiceId: invoice.invoiceId, amount: invoice.amount,
    currency: invoice.currency, vendorId: invoice.vendorId, destination: 'payments:demo-ledger',
  };
  console.log(`Proposal: payments:create($${invoice.amount.toLocaleString()})`);

  const { result, event } = authority.evaluate({
    agentId, resource: 'payments', action: 'create', input: { currency: invoice.currency, amount: invoice.amount }
  });
  console.log(`Gate: ${result.decision.toUpperCase()} — ${result.reasons.join(' ')}`);

  const tools: ToolInvocation[] = [
    { name: 'read_invoice', input: { invoiceId: invoice.invoiceId }, output: { extracted: true }, resultStatus: 'success' },
    { name: 'lookup_vendor', input: { vendorId: invoice.vendorId }, output: { active: true }, resultStatus: 'success' },
  ];
  const extras: LedgerEvent[] = [{ type: 'proposal', at: event.timestamp, payload: proposal }];

  if (result.decision === 'allow') {
    console.log('Execution: simulated payment submitted.');
    tools.push({ name: 'request_payment', input: proposal, output: { paymentId: `PAY-DEMO-${invoice.invoiceId.slice(-4)}`, status: 'submitted' }, resultStatus: 'success' });
    extras.push({ type: 'execution_attempt', at: new Date().toISOString(), payload: { tool: 'request_payment', status: 'submitted' } });
    extras.push({ type: 'destination', at: new Date().toISOString(), payload: { destination: proposal.destination } });
    extras.push({ type: 'outcome', at: new Date().toISOString(), payload: { status: 'completed', paymentId: `PAY-DEMO-${invoice.invoiceId.slice(-4)}` } });
  } else if (result.decision === 'ask') {
    console.log('Approval: human review requested.');
    const approval = approvePayment({
      event,
      request: { agentId, resource: 'payments', action: 'create', input: { currency: invoice.currency, amount: invoice.amount } },
      approver: 'finance.manager@example.com'
    });
    console.log(`Approval: ${approval.approved ? 'APPROVED' : 'REJECTED'} — ${approval.reason}`);
    extras.push({ type: 'approval', at: new Date().toISOString(), payload: { approvalId: approval.approvalId, status: approval.approved ? 'approved' : 'rejected', approver: 'finance.manager@example.com', actionDigest: event.actionDigest } });
    if (approval.approved) {
      console.log('Execution: simulated payment submitted after approval.');
      tools.push({ name: 'request_payment', input: proposal, output: { paymentId: `PAY-DEMO-${invoice.invoiceId.slice(-4)}`, status: 'submitted' }, resultStatus: 'success' });
      extras.push({ type: 'execution_attempt', at: new Date().toISOString(), payload: { tool: 'request_payment', status: 'submitted', approvalId: approval.approvalId } });
      extras.push({ type: 'destination', at: new Date().toISOString(), payload: { destination: proposal.destination } });
      extras.push({ type: 'outcome', at: new Date().toISOString(), payload: { status: 'completed', paymentId: `PAY-DEMO-${invoice.invoiceId.slice(-4)}`, approvalId: approval.approvalId } });
    } else {
      extras.push({ type: 'outcome', at: new Date().toISOString(), payload: { status: 'approval_rejected', reason: approval.reason } });
    }
  } else {
    console.log('Execution: BLOCKED — no payment tool invocation permitted.');
    extras.push({ type: 'execution_attempt', at: new Date().toISOString(), payload: { tool: 'request_payment', status: 'blocked' } });
    extras.push({ type: 'destination', at: new Date().toISOString(), payload: { destination: proposal.destination, reached: false } });
    extras.push({ type: 'outcome', at: new Date().toISOString(), payload: { status: 'blocked', reason: result.reasons[0] } });
  }

  printReceipt(makeReceipt(invoice, event, tools, extras));
}
