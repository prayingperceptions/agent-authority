import { createHash, randomUUID } from 'node:crypto';
import type { ActionRequest, AgentContract, AgentPassport, Capability, GateResult } from './domain.js';

function digest(value: unknown): string {
  const canonicalize = (v: unknown): string => {
    if (v === null || typeof v !== 'object') return JSON.stringify(v);
    if (Array.isArray(v)) return `[${v.map(canonicalize).join(',')}]`;
    const record = v as Record<string, unknown>;
    return `{${Object.keys(record).sort().map(k => `${JSON.stringify(k)}:${canonicalize(record[k])}`).join(',')}}`;
  };
  return createHash('sha256').update(canonicalize(value), 'utf8').digest('hex');
}

function active(start: string, end: string, now: Date): boolean {
  const a = new Date(start).getTime();
  const b = new Date(end).getTime();
  return Number.isFinite(a) && Number.isFinite(b) && now.getTime() >= a && now.getTime() <= b;
}

function matches(constraints: Record<string, unknown> | undefined, input: Record<string, unknown> | undefined): boolean {
  if (!constraints) return true;
  if (!input) return false;
  return Object.entries(constraints).every(([key, expected]) => {
    const actual = key === 'amount_lte' ? input.amount : input[key];
    if (key === 'amount_lte' && typeof expected === 'number' && typeof actual === 'number') return actual <= expected;
    if (Array.isArray(expected)) return expected.includes(actual);
    if (expected && typeof expected === 'object' && actual && typeof actual === 'object') {
      return Object.entries(expected as Record<string, unknown>).every(([k, v]) => (actual as Record<string, unknown>)[k] === v);
    }
    return actual === expected;
  });
}

export interface AuthorityEvent {
  eventId: string;
  timestamp: string;
  agentId: string;
  contractId: string;
  actionDigest: string;
  request: ActionRequest;
  decision: GateResult['decision'];
  reasons: string[];
}

export class AgentAuthorityAdapter {
  constructor(private readonly passport: AgentPassport, private readonly contract: AgentContract) {}

  evaluate(request: ActionRequest, now = new Date()): { result: GateResult; event: AuthorityEvent } {
    const result = this.check(request, now);
    const event: AuthorityEvent = {
      eventId: `event_${randomUUID()}`,
      timestamp: now.toISOString(),
      agentId: request.agentId,
      contractId: this.contract.contractId,
      actionDigest: digest(request),
      request,
      decision: result.decision,
      reasons: result.reasons,
    };
    return { result, event };
  }

  private check(request: ActionRequest, now: Date): GateResult {
    if (request.agentId !== this.passport.agentId) return { decision: 'deny', reasons: ['Agent identity does not match Passport.'] };
    if (new Date(this.passport.expiresAt).getTime() < now.getTime()) return { decision: 'deny', reasons: ['Passport is expired.'] };
    if (request.agentId !== this.contract.subjectAgentId) return { decision: 'deny', reasons: ['Agent identity does not match Contract subject.'] };
    if (!active(this.contract.createdAt, this.contract.expiresAt, now)) return { decision: 'deny', reasons: ['Contract is not active.'] };

    const capability = this.contract.capabilities.find((c) => c.resource === request.resource && c.actions.includes(request.action) && matches(c.constraints, request.input));
    if (!capability) return { decision: 'deny', reasons: ['No matching capability or constraints were not satisfied.'] };
    const decision = capability.decision ?? 'allow';
    const reason = decision === 'ask' ? 'Matched capability is human-approval gated.' : `Matched capability ${request.resource}:${request.action}.`;
    return { decision, matchedCapability: capability, reasons: [reason] };
  }
}

export function authorityScore(contract: AgentContract): number {
  let score = 100;
  if (contract.capabilities.some((c) => ['process', 'shell', 'os'].includes(c.resource))) score -= 30;
  if (contract.capabilities.some((c) => c.resource === 'payments' && !c.constraints)) score -= 25;
  if (contract.capabilities.every((c) => c.constraints && Object.keys(c.constraints).length > 0)) score += 8;
  if (contract.capabilities.some((c) => c.decision === 'ask')) score += 5;
  return Math.max(0, Math.min(100, score));
}

export function buildContract(agentId: string, maxPayment: number): AgentContract {
  const now = new Date();
  const expiry = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const autonomous: Capability = { resource: 'payments', actions: ['create'], constraints: { currency: 'USD', amount_lte: Math.min(500, maxPayment) }, decision: 'allow' };
  const review: Capability = { resource: 'payments', actions: ['create'], constraints: { currency: 'USD', amount_lte: maxPayment }, decision: 'ask' };
  return {
    version: '0.1', contractId: `contract_${randomUUID()}`, subjectAgentId: agentId, issuer: 'authority-ops-demo',
    purpose: 'Process vendor invoices within delegated spending authority.', createdAt: now.toISOString(), expiresAt: expiry.toISOString(), capabilities: [autonomous, review]
  };
}
