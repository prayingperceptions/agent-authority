import type { Invoice } from './domain.js';

export interface PolicyCheck {
  allowedVendor: boolean;
  amountWithinReviewThreshold: boolean;
  reason: string;
}

export function checkInvoicePolicy(invoice: Invoice): PolicyCheck {
  const allowedVendor = invoice.vendorId !== 'V-099';
  const amountWithinReviewThreshold = invoice.amount <= 1000;
  if (!allowedVendor) return { allowedVendor, amountWithinReviewThreshold, reason: 'Vendor is blocked by policy.' };
  if (!amountWithinReviewThreshold) return { allowedVendor, amountWithinReviewThreshold, reason: 'Invoice exceeds the normal autonomous processing threshold.' };
  return { allowedVendor, amountWithinReviewThreshold, reason: 'Invoice is within normal processing policy.' };
}
