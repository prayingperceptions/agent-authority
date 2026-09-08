import assert from 'node:assert/strict';
import * as core from '../packages/core/dist/index.js';
import { AgentBox } from '../packages/box/dist/index.js';

const issuer = core.generateAgentKeypair();
const agent = core.generateAgentKeypair();
const passport = core.createPassport({
  issuer: 'issuer-1',
  agentId: 'agent-red-team',
  subject: 'agent-red-team',
  publicKeyJwk: agent.publicKeyJwk,
  expiresAt: '2099-01-01T00:00:00.000Z',
});
const signedPassport = core.signPassport(passport, agent.privateKeyJwk);
assert.equal(core.verifyPassport(passport, signedPassport), true, 'self-signed passport should verify');
assert.equal(core.verifyPassport({ ...passport, agentId: 'attacker' }, signedPassport), false, 'tampered passport must fail');

const contract = core.createContract({
  subjectAgentId: passport.agentId,
  issuer: passport.issuer,
  purpose: 'red team test',
  expiresAt: '2099-01-01T00:00:00.000Z',
  capabilities: [
    { resource: 'email', actions: ['send'], constraints: { domain: 'example.com' } },
    { resource: 'github', actions: ['read'] },
  ],
  approvals: { requiredFor: ['email:send'] },
});
const signedContract = core.signContract(contract, issuer.privateKeyJwk);
const gate = new core.AuthorityGate({ trustedIssuers: { 'issuer-1': issuer.publicKeyJwk } });

// Authenticated happy path.
const authenticated = gate.checkAuthenticated({
  passport,
  signedPassport,
  contract,
  signedContract,
  request: { agentId: passport.agentId, resource: 'github', action: 'read' },
});
assert.equal(authenticated.decision, 'allow');

// Wrong issuer trust / tampered signatures must fail closed.
const wrongKeys = core.generateAgentKeypair();
const badGate = new core.AuthorityGate({ trustedIssuers: { 'issuer-1': wrongKeys.publicKeyJwk } });
assert.equal(badGate.checkAuthenticated({ passport, signedPassport, contract, signedContract, request: { agentId: passport.agentId, resource: 'github', action: 'read' } }).decision, 'deny');
const tamperedContract = { ...contract, purpose: 'changed' };
assert.equal(gate.checkAuthenticated({ passport, signedPassport, contract: tamperedContract, signedContract, request: { agentId: passport.agentId, resource: 'github', action: 'read' } }).decision, 'deny');
const tamperedCaps = { ...contract, capabilities: [...contract.capabilities, { resource: 'admin', actions: ['write'] }] };
assert.equal(gate.checkAuthenticated({ passport, signedPassport, contract: tamperedCaps, signedContract, request: { agentId: passport.agentId, resource: 'github', action: 'read' } }).decision, 'deny');

// Approval replay: first consumption succeeds, second fails.
const ask = gate.check(contract, { agentId: passport.agentId, resource: 'email', action: 'send', input: { domain: 'example.com' } });
assert.equal(ask.decision, 'ask');
const approvalRequest = core.createApprovalRequest({ contract, event: ask.event, requestedBy: passport.agentId });
const approvalReceipt = core.createApprovalReceipt({ request: approvalRequest, agentId: passport.agentId, approvedBy: 'reviewer', decision: 'approved' });
const approver = core.generateAgentKeypair();
const signedApproval = core.signEnvelope(approvalReceipt, approver.privateKeyJwk, 'reviewer');
const firstApproval = gate.checkApproved({
  contract,
  request: ask.event.request,
  approvalRequest,
  approvalReceipt,
  signedApprovalReceipt: signedApproval,
  approverPublicKeyJwk: approver.publicKeyJwk,
});
assert.equal(firstApproval.decision, 'allow');
const unsignedPair = gate.checkApproved({ contract, request: ask.event.request, approvalRequest, approvalReceipt, signedApprovalReceipt: undefined, approverPublicKeyJwk: approver.publicKeyJwk });
assert.equal(unsignedPair.decision, 'deny');
const replay = gate.checkApproved({
  contract,
  request: ask.event.request,
  approvalRequest,
  approvalReceipt,
  signedApprovalReceipt: signedApproval,
  approverPublicKeyJwk: approver.publicKeyJwk,
});
assert.equal(replay.decision, 'deny');
assert.match(replay.reasons.join(' '), /already been consumed/i);

// Approval cannot be replayed against a changed request.
const changed = gate.checkApproved({
  contract,
  request: { ...ask.event.request, input: { domain: 'evil.com' } },
  approvalRequest,
  approvalReceipt,
  signedApprovalReceipt: core.signEnvelope(approvalReceipt, approver.privateKeyJwk, 'reviewer'),
  approverPublicKeyJwk: approver.publicKeyJwk,
});
assert.equal(changed.decision, 'deny');

// Revocation fail-closed.
gate.revoke(passport.passportId);
assert.equal(gate.checkAuthenticated({ passport, signedPassport, contract, signedContract, request: { agentId: passport.agentId, resource: 'github', action: 'read' } }).decision, 'deny');

await (async () => {
  const freshGate = new core.AuthorityGate();
  const freshContract = core.createContract({
    subjectAgentId: passport.agentId,
    issuer: passport.issuer,
    purpose: 'box test',
    expiresAt: '2099-01-01T00:00:00.000Z',
    capabilities: [{ resource: 'process', actions: ['execute'], constraints: { command: 'node' } }],
  });
  const box = new AgentBox({ passport, contract: freshContract, gate: freshGate });
  const secretName = 'AGENT_AUTHORITY_RED_TEAM_SECRET';
  process.env[secretName] = 'DO_NOT_LEAK';
  const result = await box.runProcess('node', ['-e', `process.stdout.write(process.env.${secretName} ?? "ABSENT")`]);
  delete process.env[secretName];
  assert.equal(result.status, 'completed');
  assert.equal(result.value.stdout, 'ABSENT', 'Box must not inherit the host environment');
  await box.dispose();
  const escapeBox = new AgentBox({ passport, contract: freshContract, gate: freshGate, limits: { cwd: '/' } });
  const escape = await escapeBox.runProcess('node', ['-e', '']);
  assert.equal(escape.status, 'failed');
  assert.match(escape.error ?? '', /cwd must remain inside/);
  await escapeBox.dispose();
})();

console.log('RED_TEAM_OK authenticated identity + contract issuer trust + approval replay prevention + request binding + revocation + Box env/cwd boundary');
