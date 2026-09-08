import type { ActionRequest, Invoice } from './domain.js';

export function buildTrustedPaymentRequest(agentId: string, invoice: Invoice, destination: string): ActionRequest {
  return {
    agentId,
    resource: 'payments',
    action: 'create',
    input: {
      invoiceId: invoice.invoiceId,
      vendorId: invoice.vendorId,
      currency: invoice.currency,
      amount: invoice.amount,
      destination,
    },
  };
}
