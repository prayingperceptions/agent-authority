import {
  generateAgentKeypair,
  createPassport,
  createContract,
  signEnvelope,
  verifyEnvelope,
  evaluate,
  canDelegate
} from '../packages/core/src/index.ts';

const keys = generateAgentKeypair();
const passport = createPassport({ issuer: 'jubilee-labs', publicKeyJwk: keys.publicKeyJwk, metadata: { role: 'research-agent' } });
const contract = createContract({
  subjectAgentId: passport.agentId,
  issuer: passport.issuer,
  purpose: 'Prepare a report from approved sources',
  expiresAt: '2099-01-01T00:00:00.000Z',
  capabilities: [
    { resource: 'web.search', actions: ['query'] },
    { resource: 'reports', actions: ['write'] },
    { resource: 'email', actions: ['send'] }
  ],
  approvals: { requiredFor: ['email:send'] }
});

const signed = signEnvelope(contract, keys.privateKeyJwk, passport.agentId);
console.log('passport:', passport.passportId);
console.log('signed contract valid:', verifyEnvelope(signed, passport.publicKeyJwk));
console.log('report write:', evaluate(contract, { agentId: passport.agentId, resource: 'reports', action: 'write' }));
console.log('email send:', evaluate(contract, { agentId: passport.agentId, resource: 'email', action: 'send' }));
console.log('child delegation allowed:', canDelegate(contract.capabilities, [{ resource: 'web.search', actions: ['query'] }]));
console.log('child escalation blocked:', canDelegate(contract.capabilities, [{ resource: 'web.search', actions: ['query', 'admin'] }]));
