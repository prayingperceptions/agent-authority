import { Agent, BedrockModel, tool } from '@strands-agents/sdk';
import { z } from 'zod';
import { AgentAuthorityAdapter, authorityScore, buildContract } from './authority.js';
import type { AgentPassport, Invoice } from './domain.js';

const agentId = 'agent_ap_ops';
const passport: AgentPassport = {
  version: '0.1', passportId: 'passport_live_ap_ops', agentId, issuer: 'authority-ops-demo',
  expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
};
const contract = buildContract(agentId, 1000);
const authority = new AgentAuthorityAdapter(passport, contract);

const invoices: Invoice[] = [
  { invoiceId: 'INV-1041', vendorId: 'V-021', vendorName: 'Northwind Industrial', amount: 480, currency: 'USD', description: 'Maintenance supplies', source: 'ap:inbox/INV-1041.pdf' },
  { invoiceId: 'INV-1042', vendorId: 'V-021', vendorName: 'Northwind Industrial', amount: 800, currency: 'USD', description: 'Quarterly service renewal', source: 'ap:inbox/INV-1042.pdf' },
  { invoiceId: 'INV-1043', vendorId: 'V-021', vendorName: 'Northwind Industrial', amount: 8400, currency: 'USD', description: 'Emergency equipment replacement', source: 'ap:inbox/INV-1043.pdf' },
];

const readInvoice = tool({
  name: 'read_invoice',
  description: 'Read a vendor invoice from the demo inbox and return normalized fields.',
  inputSchema: z.object({ invoiceId: z.string() }),
  callback: ({ invoiceId }) => {
    const invoice = invoices.find((x) => x.invoiceId === invoiceId);
    if (!invoice) throw new Error(`Unknown invoice ${invoiceId}`);
    return invoice;
  },
});

const requestPayment = tool({
  name: 'request_payment',
  description: 'Request a payment. This tool MUST call the authority layer before any simulated payment is created.',
  inputSchema: z.object({ invoiceId: z.string(), amount: z.number(), vendorId: z.string(), currency: z.string() }),
  callback: ({ invoiceId, amount, vendorId, currency }) => {
    const invoice = invoices.find((x) => x.invoiceId === invoiceId);
    if (!invoice) throw new Error(`Unknown invoice ${invoiceId}`);
    const { result, event } = authority.evaluate({ agentId, resource: 'payments', action: 'create', input: { currency, amount } });
    return {
      invoiceId, vendorId, amount, currency, decision: result.decision, reasons: result.reasons,
      authorityEventId: event.eventId, authorityScore: authorityScore(contract), executed: result.decision === 'allow',
    };
  },
});

const bedrockModel = new BedrockModel({
  modelId: process.env.STRANDS_MODEL_ID ?? 'global.anthropic.claude-sonnet-4-6',
  region: process.env.AWS_REGION ?? 'us-east-1',
  temperature: 0.2,
});

const agent = new Agent({
  model: bedrockModel,
  tools: [readInvoice, requestPayment],
  systemPrompt: [
    'You are Authority Ops, a professional accounts-payable operations agent.',
    'Your job is to inspect invoices and propose or request payment actions.',
    'Never treat your own proposal as authorization.',
    'Payment execution is only possible through request_payment, which is policy-controlled.',
    'For a user-selected invoice, explain the proposal, the authority decision, and the resulting outcome.',
  ].join(' '),
});

const prompt = process.argv.slice(2).join(' ') || 'Process invoice INV-1043. Read the invoice and request payment only if authorized.';
console.log(`Authority Ops live agent — authority score ${authorityScore(contract)}/100`);
console.log(`Task: ${prompt}`);
const result = await agent.invoke(prompt);
console.log('\nFINAL AGENT RESPONSE\n');
console.log(result);
