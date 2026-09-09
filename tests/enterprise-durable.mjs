import assert from 'node:assert/strict';
import { InMemoryEnterpriseStore } from '../packages/enterprise/dist/store.js';

const store = new InMemoryEnterpriseStore();
await store.init();
assert.equal((await store.readiness()).durable, false);

const tenant = 'tenant-red-team';
const policy = { policyId:'payments', version:1, tenantId:tenant, status:'draft', capabilities:[{resource:'payments',actions:['transfer'],constraints:{destination:'acct_123'},decision:'allow'}], createdBy:'policy-admin', createdAt:new Date().toISOString() };
await store.putPolicy(policy);
await assert.rejects(() => store.putPolicy(policy), /policy_version_immutable/);
await store.activatePolicy(tenant,'payments',1);

const binding = { tenantId:tenant, policyId:'payments', policyVersion:1, contract:{version:'0.1',contractId:'contract_test',createdAt:new Date().toISOString(),subjectAgentId:'agent_1',issuer:'issuer',purpose:'test',expiresAt:new Date(Date.now()+60000).toISOString(),capabilities:policy.capabilities} };
await store.putContract(binding);
assert.ok(await store.getContract(tenant,'contract_test'));
assert.equal(await store.consumeNonce(tenant,'nonce_1234567890123456'), true);
assert.equal(await store.consumeNonce(tenant,'nonce_1234567890123456'), false);
assert.equal(await store.revokeContract(tenant,'contract_test'), true);
assert.equal(await store.getContract(tenant,'contract_test'), undefined);

const request={version:'0.1',approvalId:'approval_test',contractId:'contract_test',eventId:'event_test',requestedBy:'agent-requester',createdAt:new Date().toISOString(),expiresAt:new Date(Date.now()+60000).toISOString(),nonce:'approval_nonce_123456',actionDigest:'digest_test',purpose:'approve payment'};
await store.putApproval(tenant,request);
await assert.rejects(() => store.decideApproval(tenant,'approval_test','agent-requester','approved'), /separation_of_duties_violation/);
const decided=await store.decideApproval(tenant,'approval_test','human-approver','approved');
assert.equal(decided.status,'approved');
const consumed=await store.consumeApproval(tenant,'approval_test','digest_test');
assert.equal(consumed.status,'consumed');
await assert.rejects(() => store.consumeApproval(tenant,'approval_test','digest_test'), /approval_not_approved/);

console.log('✓ durable enterprise store red-team tests passed');
