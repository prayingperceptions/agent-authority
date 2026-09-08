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

console.log('AUTHORITY OPS');
console.log('Professional invoice agent + delegated authority demo');
console.log(`Authority Score: ${authorityScore(contract)}/100`);
console.log('Delegated payment limit: $1,000 USD');

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
    tools.push({ name: 'request_payment', input: proposal, output: { paymentId: 'PAY-DEMO-1041', status: 'submitted' }, resultStatus: 'success' });
    extras.push({ type: 'execution_attempt', at: new Date().toISOString(), payload: { tool: 'request_payment', status: 'submitted' } });
    extras.push({ type: 'destination', at: new Date().toISOString(), payload: { destination: 'payments:demo-ledger' } });
    extras.push({ type: 'outcome', at: new Date().toISOString(), payload: { status: 'completed', paymentId: 'PAY-DEMO-1041' } });
  } else if (result.decision === 'ask') {
    console.log('Execution: waiting for human approval.');
    extras.push({ type: 'approval', at: new Date().toISOString(), payload: { status: 'pending', reason: 'Human approval required by authority policy.' } });
    extras.push({ type: 'outcome', at: new Date().toISOString(), payload: { status: 'approval_required' } });
  } else {
    console.log('Execution: BLOCKED — no payment tool invocation permitted.');
    extras.push({ type: 'execution_attempt', at: new Date().toISOString(), payload: { tool: 'request_payment', status: 'blocked' } });
    extras.push({ type: 'outcome', at: new Date().toISOString(), payload: { status: 'blocked', reason: result.reasons[0] } });
  }

  printReceipt(makeReceipt(invoice, event, tools, extras));
}
