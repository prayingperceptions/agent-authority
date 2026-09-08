function assertEqual(actual: unknown, expected: unknown, message = 'assertion failed'): void {
  if (actual !== expected) throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
}

import { AgentAuthorityAdapter, buildContract } from './authority.js';
import type { AgentPassport } from './domain.js';

const agentId = 'agent_test';
const passport: AgentPassport = {
  version: '0.1', passportId: 'passport_test', agentId, issuer: 'test',
  expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
};
const authority = new AgentAuthorityAdapter(passport, buildContract(agentId, 1000));

const low = authority.evaluate({ agentId, resource: 'payments', action: 'create', input: { currency: 'USD', amount: 500 } });
assertEqual(low.result.decision, 'allow', 'Autonomous tier should allow a payment at or below $500.');

const review = authority.evaluate({ agentId, resource: 'payments', action: 'create', input: { currency: 'USD', amount: 800 } });
assertEqual(review.result.decision, 'ask', 'Review tier should require human approval.');

const wrongAgent = authority.evaluate({ agentId: 'other', resource: 'payments', action: 'create', input: { currency: 'USD', amount: 500 } });
assertEqual(wrongAgent.result.decision, 'deny');

const overLimit = authority.evaluate({ agentId, resource: 'payments', action: 'create', input: { currency: 'USD', amount: 8400 } });
assertEqual(overLimit.result.decision, 'deny');

console.log('✓ authority boundary tests passed');
