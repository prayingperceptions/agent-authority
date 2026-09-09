import assert from 'node:assert/strict';
import test from 'node:test';
import { createEnterpriseState, createPolicy, registerPolicy, activatePolicy, issueEnterpriseContract, authorize, revokeContract } from '../packages/enterprise/dist/index.js';

function setup() {
  const state = createEnterpriseState();
  const principal = { tenantId: 'tenant-a', subject: 'policy-admin', roles: ['policy-admin'] };
  const policy = createPolicy({
    policyId: 'payments',
    version: 1,
    tenantId: 'tenant-a',
    capabilities: [{ resource: 'payments', actions: ['create'], constraints: { currency: 'USD', destination: 'payments:demo' }, decision: 'allow' }],
    createdBy: principal.subject
  });
  registerPolicy(state, principal, policy);
  activatePolicy(state, principal, 'payments', 1);
  const contract = issueEnterpriseContract({ principal, agentId: 'agent-1', policy: state.policies.get('tenant-a:payments:1'), purpose: 'invoice processing', expiresAt: new Date(Date.now()+60000).toISOString() });
  return { state, principal: { ...principal, subject: 'agent-1', roles: [] }, contract };
}

test('allows a bounded action', () => {
  const {state, principal, contract} = setup();
  const event = authorize(state, principal, 'corr-1', contract, { agentId:'agent-1', resource:'payments', action:'create', input:{currency:'USD',destination:'payments:demo'}, nonce:'nonce-allow-123456' });
  assert.equal(event.decision, 'allow');
});

test('blocks destination substitution', () => {
  const {state, principal, contract} = setup();
  const event = authorize(state, principal, 'corr-2', contract, { agentId:'agent-1', resource:'payments', action:'create', input:{currency:'USD',destination:'payments:attacker'}, nonce:'nonce-destination-123456' });
  assert.equal(event.decision, 'deny');
});

test('blocks nonce replay', () => {
  const {state, principal, contract} = setup();
  const request = { agentId:'agent-1', resource:'payments', action:'create', input:{currency:'USD',destination:'payments:demo'}, nonce:'nonce-replay-123456' };
  assert.equal(authorize(state, principal, 'corr-3', contract, request).decision, 'allow');
  assert.equal(authorize(state, principal, 'corr-4', contract, request).decision, 'deny');
});

test('revocation fails closed', () => {
  const {state, principal, contract} = setup();
  revokeContract(state, principal, contract.contract.contractId);
  const event = authorize(state, principal, 'corr-5', contract, { agentId:'agent-1', resource:'payments', action:'create', input:{currency:'USD',destination:'payments:demo'}, nonce:'nonce-revoked-123456' });
  assert.equal(event.decision, 'deny');
});

test('tenant mismatch fails closed', () => {
  const {state, contract} = setup();
  const event = authorize(state, {tenantId:'tenant-b',subject:'agent-1',roles:[]}, 'corr-6', contract, { agentId:'agent-1', resource:'payments', action:'create', input:{currency:'USD',destination:'payments:demo'}, nonce:'nonce-tenant-123456' });
  assert.equal(event.decision, 'deny');
});

test('policy versions are immutable', () => {
  const state=createEnterpriseState();
  const principal={tenantId:'tenant-a',subject:'admin',roles:['policy-admin']};
  const policy=createPolicy({policyId:'p',version:1,tenantId:'tenant-a',capabilities:[{resource:'x',actions:['read']}],createdBy:'admin'});
  registerPolicy(state,principal,policy);
  assert.throws(()=>registerPolicy(state,principal,policy),/policy_version_immutable/);
});
