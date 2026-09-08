import assert from 'node:assert/strict';
import * as core from '../packages/core/dist/index.js';

const keys = core.generateAgentKeypair();
const passport = core.createPassport({ issuer: 'jubilee-labs', publicKeyJwk: keys.publicKeyJwk });
assert.deepEqual(core.validatePassport(passport), []);

const contract = core.createContract({
  subjectAgentId: passport.agentId,
  issuer: passport.issuer,
  purpose: 'smoke test',
  expiresAt: '2099-01-01T00:00:00.000Z',
  capabilities: [
    { resource: 'github', actions: ['read', 'write'] },
    { resource: 'email', actions: ['send'] }
  ],
  approvals: { requiredFor: ['email:send'] }
});
assert.deepEqual(core.validateContract(contract), []);

const gate = new core.AuthorityGate({ privateKeyJwk: keys.privateKeyJwk, signer: 'gate_smoke' });
const allow = gate.check(contract, { agentId: passport.agentId, resource: 'github', action: 'read' });
const ask = gate.check(contract, { agentId: passport.agentId, resource: 'email', action: 'send' });
const deny = gate.check(contract, { agentId: passport.agentId, resource: 'github', action: 'admin' });
assert.equal(allow.decision, 'allow');
assert.equal(ask.decision, 'ask');
assert.equal(deny.decision, 'deny');
assert.ok(allow.signedEvent);
assert.equal(core.verifyEnvelope(allow.signedEvent, keys.publicKeyJwk), true);

assert.equal(core.canDelegate(contract.capabilities, [{ resource: 'github', actions: ['read'] }]), true);
assert.equal(core.canDelegate(contract.capabilities, [{ resource: 'github', actions: ['admin'] }]), false);
console.log('SMOKE_OK allow,ask,deny + audit signature + delegation guard');

const approvalRequest = core.createApprovalRequest({ contract, event: ask.event, requestedBy: passport.agentId });
const approvalReceipt = core.createApprovalReceipt({ request: approvalRequest, agentId: passport.agentId, approvedBy: 'human', decision: 'approved', reason: 'Reviewed' });
const signedApproval = core.signEnvelope(approvalReceipt, keys.privateKeyJwk, 'human');
const ledgerBundle = core.createLedgerEvidenceBundle({
  passport,
  contract,
  event: ask.event,
  authorityEvent: ask.signedEvent,
  approvalRequest,
  approvalReceipt,
  signedApprovalReceipt: signedApproval,
  framework: 'generic',
  approvalStatus: 'approved',
  tools: [{ name: 'email', invocationCount: 1, resultStatus: 'success' }]
});
assert.equal(ledgerBundle.receipt.schema_version, 'receipt-v1');
assert.equal(core.verifyLedgerReceipt(ledgerBundle.receipt), true);
assert.equal(core.verifyEnvelope(ledgerBundle.authorityEvent, keys.publicKeyJwk), true);
assert.equal(core.verifyEnvelope(ledgerBundle.signedApprovalReceipt, keys.publicKeyJwk), true);
console.log('LEDGER_INTEROP_SMOKE_OK');
