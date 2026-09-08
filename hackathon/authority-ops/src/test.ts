function assertEqual(actual: unknown, expected: unknown, message = 'assertion failed'): void {
  if (actual !== expected) throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
}

import { AgentAuthorityAdapter, buildContract } from './authority.js';
import { buildTrustedPaymentRequest } from './payment.js';
import type { AgentPassport, Invoice } from './domain.js';

const agentId = 'agent_test';
const paymentDestination = 'payments:demo-ledger';
const passport: AgentPassport = {
  version: '0.1', passportId: 'passport_test', agentId, issuer: 'test',
  expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
};
const authority = new AgentAuthorityAdapter(passport, buildContract(agentId, 1000, paymentDestination));

const lowInvoice: Invoice = {
  invoiceId: 'INV-1041', vendorId: 'V-021', vendorName: 'Northwind Industrial', amount: 480,
  currency: 'USD', description: 'Maintenance supplies', source: 'ap:inbox/INV-1041.pdf'
};
const highInvoice: Invoice = {
  invoiceId: 'INV-1043', vendorId: 'V-021', vendorName: 'Northwind Industrial', amount: 8400,
  currency: 'USD', description: 'Emergency equipment replacement', source: 'ap:inbox/INV-1043.pdf'
};

const low = authority.evaluate(buildTrustedPaymentRequest(agentId, lowInvoice, paymentDestination));
assertEqual(low.result.decision, 'allow', 'Autonomous tier should allow a trusted invoice at or below $500.');
assertEqual(low.event.request.input?.amount, 480);
assertEqual(low.event.request.input?.invoiceId, 'INV-1041');

const review = authority.evaluate({ agentId, resource: 'payments', action: 'create', input: { currency: 'USD', amount: 800, destination: paymentDestination } });
assertEqual(review.result.decision, 'ask', 'Review tier should require human approval.');

const wrongAgent = authority.evaluate({ agentId: 'other', resource: 'payments', action: 'create', input: { currency: 'USD', amount: 500, destination: paymentDestination } });
assertEqual(wrongAgent.result.decision, 'deny', 'A different agent identity must be denied.');

const overLimit = authority.evaluate(buildTrustedPaymentRequest(agentId, highInvoice, paymentDestination));
assertEqual(overLimit.result.decision, 'deny', 'Trusted invoice amount must remain authoritative and deny the $8,400 invoice.');
assertEqual(overLimit.event.request.input?.amount, 8400);
assertEqual(overLimit.event.request.input?.invoiceId, 'INV-1043');
assertEqual(overLimit.event.request.input?.vendorId, 'V-021');

const wrongDestination = authority.evaluate({ agentId, resource: 'payments', action: 'create', input: { currency: 'USD', amount: 400, destination: 'payments:attacker' } });
assertEqual(wrongDestination.result.decision, 'deny', 'An alternate destination must not inherit payment authority.');

assertEqual(review.event.actionDigest.length, 64);
assertEqual(overLimit.event.actionDigest.length, 64);

console.log('✓ authority boundary tests passed');
console.log('✓ trusted invoice binding test passed');
console.log('✓ destination substitution test passed');
