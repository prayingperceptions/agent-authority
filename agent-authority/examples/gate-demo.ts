import {
  AuthorityGate,
  createContract,
  generateAgentKeypair,
  verifyEnvelope
} from '../packages/core/src/index.ts';

const gateKeys = generateAgentKeypair();
const contract = createContract({
  subjectAgentId: 'agent_research_01',
  issuer: 'jubilee-labs',
  purpose: 'Prepare a report from approved sources',
  expiresAt: '2099-01-01T00:00:00.000Z',
  capabilities: [
    { resource: 'web.search', actions: ['query'] },
    { resource: 'reports', actions: ['write'] },
    { resource: 'email', actions: ['send'] }
  ],
  approvals: { requiredFor: ['email:send'] }
});

const gate = new AuthorityGate({ privateKeyJwk: gateKeys.privateKeyJwk, signer: 'gate_01' });

for (const request of [
  { agentId: 'agent_research_01', resource: 'web.search', action: 'query' },
  { agentId: 'agent_research_01', resource: 'email', action: 'send' },
  { agentId: 'agent_research_01', resource: 'github', action: 'write' }
]) {
  const result = gate.check(contract, request);
  console.log(JSON.stringify({ request, decision: result.decision, reasons: result.reasons }, null, 2));
  if (result.signedEvent) {
    console.log('audit signature valid:', verifyEnvelope(result.signedEvent, gateKeys.publicKeyJwk));
  }
}
