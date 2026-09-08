import { calculateAuthorityScore, createContract, createPassport, generateAgentKeypair, authorityScoreMarkdown } from '@jubileelabs/agent-authority-core';

const keys = generateAgentKeypair();
const passport = createPassport({
  issuer: 'demo-issuer',
  agentId: 'demo-agent',
  publicKeyJwk: keys.publicKeyJwk,
  expiresAt: '2099-01-01T00:00:00.000Z'
});
const contract = createContract({
  subjectAgentId: passport.agentId,
  issuer: 'demo-issuer',
  purpose: 'Read a repository and draft changes',
  expiresAt: '2099-01-01T00:00:00.000Z',
  capabilities: [
    { resource: 'github', actions: ['read'], constraints: { repo: 'Jubilee-Protocol/example' } },
    { resource: 'github', actions: ['write'], constraints: { repo: 'Jubilee-Protocol/example' }, decision: 'ask' }
  ],
  approvals: { requiredFor: ['github:write'] }
});

const score = calculateAuthorityScore({ passport, contract });
console.log(authorityScoreMarkdown(score));
