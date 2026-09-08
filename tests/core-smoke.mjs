import assert from 'node:assert/strict';
import {
  AuthorityGate, calculateAuthorityScore, canDelegate, createApprovalReceipt, createApprovalRequest,
  createContract, createPassport, digest, generateAgentKeypair, evaluateWithAudit, signEnvelope,
  verifyApprovalReceipt, verifyEnvelope
} from '../packages/core/dist/index.js';

const keys = generateAgentKeypair();
const passport = createPassport({ issuer: 'test-issuer', publicKeyJwk: keys.publicKeyJwk, expiresAt: '2099-01-01T00:00:00.000Z' });
const contract = createContract({
  subjectAgentId: passport.agentId,
  issuer: 'test-issuer',
  purpose: 'test task',
  expiresAt: '2099-01-01T00:00:00.000Z',
  capabilities: [
    { resource: 'github', actions: ['read'], constraints: { repo: 'example' } },
    { resource: 'email', actions: ['send'] }
  ],
  approvals: { requiredFor: ['email:send'] }
});

const allowed = new AuthorityGate().check(contract, { agentId: passport.agentId, resource: 'github', action: 'read', input: { repo: 'example' } });
assert.equal(allowed.decision, 'allow');
const asked = new AuthorityGate().check(contract, { agentId: passport.agentId, resource: 'email', action: 'send' });
assert.equal(asked.decision, 'ask');
const denied = new AuthorityGate().check(contract, { agentId: passport.agentId, resource: 'github', action: 'write', input: { repo: 'example' } });
assert.equal(denied.decision, 'deny');

const request = createApprovalRequest({ contract, event: asked.event, requestedBy: passport.agentId });
const approval = createApprovalReceipt({ request, agentId: passport.agentId, approvedBy: 'reviewer', decision: 'approved' });
assert.equal(verifyApprovalReceipt({ receipt: approval, request, event: asked.event }), true);
assert.equal(verifyApprovalReceipt({ receipt: { ...approval, actionDigest: digest({ tampered: true }) }, request, event: asked.event }), false);

const signed = evaluateWithAudit({ contract, request: { agentId: passport.agentId, resource: 'github', action: 'read', input: { repo: 'example' } }, auditPrivateKeyJwk: keys.privateKeyJwk, auditSigner: 'gate' });
assert.equal(verifyEnvelope(signed.signedEvent, keys.publicKeyJwk), true);
assert.equal(canDelegate(contract.capabilities, [{ resource: 'github', actions: ['read'], constraints: { repo: 'example' } }]), true);
assert.equal(canDelegate(contract.capabilities, [{ resource: 'github', actions: ['write'] }]), false);

const score = calculateAuthorityScore({ passport, contract, now: new Date('2026-01-01T00:00:00.000Z') });
assert.ok(score.score >= 0 && score.score <= 100);
assert.ok(['A', 'B', 'C', 'D', 'F'].includes(score.grade));
assert.ok(score.findings.some(f => f.id === 'approval-boundary'));

console.log('CORE_SMOKE_OK allow/ask/deny + approvals + signatures + delegation + authority score');
