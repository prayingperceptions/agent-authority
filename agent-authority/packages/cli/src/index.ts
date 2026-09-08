import { writeFileSync, readFileSync } from 'node:fs';
import {
  generateAgentKeypair,
  createPassport,
  createContract,
  AuthorityGate,
  calculateAuthorityScore,
  authorityScoreMarkdown,
  type ActionRequest,
  type AgentContract
} from '@jubileelabs/agent-authority-core';

const args = process.argv.slice(2);

function usage() {
  console.log(`agent-authority 0.1.6\n\nCommands:\n  passport:init <issuer>                         Create a local Ed25519 Passport\n  contract:init <agentId> <issuer>               Create a starter Contract\n  gate:check <contract.json> <action.json>       Evaluate an action\n  score <passport.json> <contract.json> [--json] Calculate Authority Score\n`);
}

async function main() {
  const [command, ...rest] = args;

  if (command === 'passport:init') {
    const issuer = rest[0] ?? 'local';
    const keys = generateAgentKeypair();
    const passport = createPassport({ issuer, publicKeyJwk: keys.publicKeyJwk });
    writeFileSync('passport.json', JSON.stringify({ passport, privateKeyJwk: keys.privateKeyJwk }, null, 2));
    console.log(JSON.stringify({ created: true, agentId: passport.agentId, passportId: passport.passportId, file: 'passport.json' }, null, 2));
    return;
  }

  if (command === 'contract:init') {
    const [agentId, issuer = 'local'] = rest;
    if (!agentId) return usage();
    const contract = createContract({
      subjectAgentId: agentId,
      issuer,
      purpose: 'Replace this purpose',
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      capabilities: [{ resource: 'example', actions: ['read'] }]
    });
    writeFileSync('contract.json', JSON.stringify(contract, null, 2));
    console.log(JSON.stringify({ created: true, contractId: contract.contractId, file: 'contract.json' }, null, 2));
    return;
  }

  if (command === 'score') {
    const [passportPath, contractPath] = rest;
    if (!passportPath || !contractPath) return usage();
    const passportFile = JSON.parse(readFileSync(passportPath, 'utf8'));
    const passport = passportFile.passport ?? passportFile;
    const contract = JSON.parse(readFileSync(contractPath, 'utf8')) as AgentContract;
    const result = calculateAuthorityScore({ passport, contract });
    if (rest.includes('--json')) console.log(JSON.stringify(result, null, 2));
    else console.log(authorityScoreMarkdown(result));
    return;
  }

  if (command === 'gate:check') {
    const [contractPath, actionPath] = rest;
    if (!contractPath || !actionPath) return usage();
    const contract = JSON.parse(readFileSync(contractPath, 'utf8')) as AgentContract;
    const request = JSON.parse(readFileSync(actionPath, 'utf8')) as ActionRequest;
    const gate = new AuthorityGate();
    console.log(JSON.stringify(gate.check(contract, request), null, 2));
    return;
  }

  usage();
}

main().catch(err => { console.error(err); process.exit(1); });
