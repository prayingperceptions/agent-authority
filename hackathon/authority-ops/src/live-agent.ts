import { Agent, BedrockModel, tool } from '@strands-agents/sdk';
import { z } from 'zod';
import { AgentAuthorityAdapter, authorityScore, buildContract } from './authority.js';
import type { AgentPassport, Invoice } from './domain.js';

const agentId = 'agent_ap_ops';
const paymentDestination = 'payments:demo-ledger';
const passport: AgentPassport = {
  version: '0.1', passportId: 'passport_live_ap_ops', agentId, issuer: 'authority-ops-demo',
  expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
};
const contract = buildContract(agentId, 1000, paymentDestination);
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
  description: 'Request payment for a known invoice. Invoice amount, vendor, currency, and destination are derived from trusted application state and evaluated by the authority gate.',
  inputSchema: z.object({ invoiceId: z.string() }),
  callback: ({ invoiceId }) => {
    const invoice = invoices.find((x) => x.invoiceId === invoiceId);
    if (!invoice) throw new Error(`Unknown invoice ${invoiceId}`);

    const request = {
      agentId,
      resource: 'payments',
      action: 'create',
      input: {
        invoiceId: invoice.invoiceId,
        vendorId: invoice.vendorId,
        currency: invoice.currency,
        amount: invoice.amount,
        destination: paymentDestination,
      },
    };

    const { result, event } = authority.evaluate(request);
    return {
      invoiceId,
      vendorId: invoice.vendorId,
      amount: invoice.amount,
      currency: invoice.currency,
      destination: paymentDestination,
      decision: result.decision,
      reasons: result.reasons,
      authorityEventId: event.eventId,
      authorityActionDigest: event.actionDigest,
      authorityScore: authorityScore(contract),
      executed: result.decision === 'allow',
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
    'Inspect invoices and request payment only through the request_payment tool.',
    'Never treat your own proposal as authorization.',
    'Never invent or override invoice amount, vendor, currency, invoice identity, or payment destination.',
    'The request_payment tool derives authoritative payment fields from the trusted invoice record and enforces the delegated authority contract.',
    'For the selected invoice, explain the proposal, authority decision, and outcome.',
  ].join(' '),
});

const prompt = process.argv.slice(2).join(' ') || 'Process invoice INV-1043. Read the invoice and request payment only if authorized.';
console.log(`Authority Ops live agent — authority score ${authorityScore(contract)}/100`);
console.log(`Task: ${prompt}`);
const result = await agent.invoke(prompt);
console.log('\nFINAL AGENT RESPONSE\n');
console.log(result);
