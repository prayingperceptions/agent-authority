import { createHash } from 'node:crypto';
import type { Invoice, ToolInvocation } from './domain.js';
import type { AuthorityEvent } from './authority.js';

export type LedgerEvent =
  | { type: 'request'; at: string; payload: Record<string, unknown> }
  | { type: 'evidence'; at: string; payload: Record<string, unknown> }
  | { type: 'proposal'; at: string; payload: Record<string, unknown> }
  | { type: 'authorization'; at: string; payload: Record<string, unknown> }
  | { type: 'approval'; at: string; payload: Record<string, unknown> }
  | { type: 'execution_attempt'; at: string; payload: Record<string, unknown> }
  | { type: 'destination'; at: string; payload: Record<string, unknown> }
  | { type: 'outcome'; at: string; payload: Record<string, unknown> };

export interface LedgerReceipt {
  receiptId: string;
  invoice: Invoice;
  events: LedgerEvent[];
  tools: ToolInvocation[];
  receiptHash: string;
}

export function makeReceipt(invoice: Invoice, authority: AuthorityEvent, tools: ToolInvocation[], extras: LedgerEvent[] = []): LedgerReceipt {
  const proposal = extras.filter((e) => e.type === 'proposal');
  const postAuthorization = extras.filter((e) => e.type !== 'proposal');
  const events: LedgerEvent[] = [
    { type: 'request', at: authority.timestamp, payload: { invoiceId: invoice.invoiceId, source: invoice.source } },
    { type: 'evidence', at: authority.timestamp, payload: { vendorId: invoice.vendorId, vendorName: invoice.vendorName, amount: invoice.amount, description: invoice.description } },
    ...proposal,
    { type: 'authorization', at: authority.timestamp, payload: { decision: authority.decision, reasons: authority.reasons, actionDigest: authority.actionDigest } },
    ...postAuthorization,
  ];
  const base = { receiptId: `receipt_${authority.eventId}`, invoice, events, tools };
  const receiptHash = createHash('sha256').update(JSON.stringify(base)).digest('hex');
  return { ...base, receiptHash };
}

export function printReceipt(receipt: LedgerReceipt): void {
  console.log('\nLEDGER RECEIPT');
  console.log('────────────────────────────────────────');
  for (const event of receipt.events) console.log(`${event.type.padEnd(20)} ${JSON.stringify(event.payload)}`);
  console.log(`receipt_hash         ${receipt.receiptHash}`);
}
