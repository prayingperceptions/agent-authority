import assert from 'node:assert/strict';
import { generateAgentKeypair, createPassport, createContract, AuthorityGate } from '../packages/core/dist/index.js';
import { AgentBox } from '../packages/box/dist/index.js';

const keys = generateAgentKeypair();
const passport = createPassport({ issuer: 'jubilee-labs', publicKeyJwk: keys.publicKeyJwk, agentId: 'agent_box_smoke' });
const contract = createContract({
  subjectAgentId: passport.agentId,
  issuer: passport.issuer,
  purpose: 'run a harmless process in a disposable workspace',
  expiresAt: '2099-01-01T00:00:00.000Z',
  capabilities: [
    { resource: 'process', actions: ['execute'], constraints: { command: 'node' } },
    { resource: 'files', actions: ['read'] },
    { resource: 'http', actions: ['get'] },
    { resource: 'browser', actions: ['navigate'] }
  ]
});
const gate = new AuthorityGate({ privateKeyJwk: keys.privateKeyJwk, signer: 'box_gate' });
const box = new AgentBox({ passport, contract, gate, agentName: 'box-smoke', framework: 'generic' });
const workspace = await box.createWorkspace();
const processRun = await box.runProcess('node', ['-e', 'process.stdout.write("BOX_OK")']);
assert.equal(processRun.status, 'completed');
assert.equal(processRun.value.stdout, 'BOX_OK');
assert.equal(processRun.gate.decision, 'allow');

const fsRun = await box.runFilesystem('files', 'read', { path: 'README.md' }, () => 'ok');
assert.equal(fsRun.status, 'completed');
const netRun = await box.runNetwork('http', 'get', { url: 'https://example.com' }, () => 'ok');
assert.equal(netRun.status, 'completed');
const browserRun = await box.runBrowser('browser', 'navigate', { url: 'https://example.com' }, () => 'ok');
assert.equal(browserRun.status, 'completed');

assert.equal(box.summary().completed, 4);
assert.equal(box.summary().blocked, 0);
assert.equal(processRun.ledger.receipt.metadata.box_id, box.boxId);
await box.dispose();
console.log('BOX_SMOKE_OK contract-gated process/files/network/browser + ledger evidence + disposable workspace');
