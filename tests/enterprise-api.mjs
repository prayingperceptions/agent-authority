import assert from 'node:assert/strict';
import test from 'node:test';
import { createEnterpriseServer } from '../packages/enterprise/dist/server.js';
import { activatePolicy, createEnterpriseState, createPolicy, registerPolicy } from '../packages/enterprise/dist/index.js';

const admin = { tenantId: 'tenant-api', subject: 'admin-1', roles: ['policy-admin', 'contract-admin', 'security-admin'] };
const agent = { tenantId: 'tenant-api', subject: 'agent-1', roles: [] };

async function withServer(fn) {
  const state = createEnterpriseState();
  const policy = createPolicy({
    policyId: 'payments',
    version: 1,
    tenantId: admin.tenantId,
    capabilities: [{ resource: 'payments', actions: ['create'], constraints: { currency: 'USD', destination: 'payments:demo' } }],
    createdBy: admin.subject
  });
  registerPolicy(state, admin, policy);
  activatePolicy(state, admin, 'payments', 1);

  const server = createEnterpriseServer({
    state,
    resolvePrincipal: async (authorization) => authorization === 'Bearer admin' ? admin : agent
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const base = `http://127.0.0.1:${address.port}`;
  try { await fn({ base, state }); } finally { await new Promise(resolve => server.close(resolve)); }
}

async function request(base, path, method, body, token) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const data = await res.json();
  return { res, data };
}

test('health is unauthenticated while control plane is authenticated', async () => {
  await withServer(async ({ base }) => {
    const health = await fetch(`${base}/healthz`);
    assert.equal(health.status, 200);
    const policies = await request(base, '/v1/policies', 'POST', { tenantId: 'tenant-api', policyId: 'x', version: 1, status: 'draft', capabilities: [], createdBy: 'admin-1', createdAt: new Date().toISOString() }, 'bad');
    assert.equal(policies.res.status, 403);
  });
});

test('control plane issues a contract and enforces destination binding', async () => {
  await withServer(async ({ base }) => {
    const created = await request(base, '/v1/contracts', 'POST', {
      agentId: 'agent-1', policyId: 'payments', policyVersion: 1, purpose: 'invoice processing', expiresAt: new Date(Date.now() + 60_000).toISOString()
    }, 'admin');
    assert.equal(created.res.status, 201);
    const contractId = created.data.contract.contractId;

    const allowed = await request(base, '/v1/check', 'POST', {
      contractId,
      request: { agentId: 'agent-1', resource: 'payments', action: 'create', input: { currency: 'USD', destination: 'payments:demo' }, nonce: 'api-nonce-allow-123456' }
    }, 'agent');
    assert.equal(allowed.res.status, 200);
    assert.equal(allowed.data.decision, 'allow');

    const attack = await request(base, '/v1/check', 'POST', {
      contractId,
      request: { agentId: 'agent-1', resource: 'payments', action: 'create', input: { currency: 'USD', destination: 'payments:attacker' }, nonce: 'api-nonce-attack-123456' }
    }, 'agent');
    assert.equal(attack.res.status, 200);
    assert.equal(attack.data.decision, 'deny');
  });
});

test('revocation blocks an otherwise allowed contract', async () => {
  await withServer(async ({ base }) => {
    const created = await request(base, '/v1/contracts', 'POST', {
      agentId: 'agent-1', policyId: 'payments', policyVersion: 1, purpose: 'invoice processing', expiresAt: new Date(Date.now() + 60_000).toISOString()
    }, 'admin');
    const contractId = created.data.contract.contractId;
    const revoked = await request(base, '/v1/revocations/contract', 'POST', { contractId }, 'admin');
    assert.equal(revoked.res.status, 200);

    const denied = await request(base, '/v1/check', 'POST', {
      contractId,
      request: { agentId: 'agent-1', resource: 'payments', action: 'create', input: { currency: 'USD', destination: 'payments:demo' }, nonce: 'api-nonce-revoked-123456' }
    }, 'agent');
    assert.equal(denied.res.status, 404);
    assert.equal(denied.data.error, 'contract_not_found');
  });
});
