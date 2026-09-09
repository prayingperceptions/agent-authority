import { createServer as createHttpServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';
import { activatePolicy, authorize, createEnterpriseState, issueEnterpriseContract, registerPolicy, revokeContract, type EnterprisePrincipal, type EnterpriseState, type PolicyVersion } from './index.js';
import { verifyJwt, type JwtOptions, type Principal } from './jwt.js';

export interface EnterpriseServerOptions {
  state?: EnterpriseState;
  jwt?: JwtOptions;
  maxBodyBytes?: number;
  resolvePrincipal?: (authorization: string | undefined) => Promise<EnterprisePrincipal>;
}

const json = (res: ServerResponse, status: number, body: unknown) => {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
};

const securityHeaders = (res: ServerResponse) => {
  res.setHeader('cache-control', 'no-store');
  res.setHeader('x-content-type-options', 'nosniff');
  res.setHeader('x-frame-options', 'DENY');
  res.setHeader('referrer-policy', 'no-referrer');
};

async function readJson(req: IncomingMessage, maxBodyBytes: number): Promise<any> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > maxBodyBytes) throw new Error('request_too_large');
    chunks.push(buffer);
  }
  if (!chunks.length) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw new Error('invalid_json'); }
}

function requireRole(principal: EnterprisePrincipal, role: string): void {
  if (!principal.roles.includes(role)) throw new Error('forbidden');
}

function policyFor(state: EnterpriseState, tenantId: string, policyId: string, version: number): PolicyVersion {
  const policy = state.policies.get(`${tenantId}:${policyId}:${version}`);
  if (!policy) throw new Error('policy_not_found');
  return policy;
}

async function defaultPrincipal(auth: string | undefined, jwt: JwtOptions): Promise<EnterprisePrincipal> {
  const principal: Principal = await verifyJwt(auth, jwt);
  return principal;
}

export function createEnterpriseServer(options: EnterpriseServerOptions) {
  const state = options.state ?? createEnterpriseState();
  const maxBodyBytes = options.maxBodyBytes ?? 256 * 1024;
  if (!options.resolvePrincipal && !options.jwt) throw new Error('jwt_configuration_required');

  const resolvePrincipal = options.resolvePrincipal ?? ((auth) => defaultPrincipal(auth, options.jwt!));

  return createHttpServer(async (req, res) => {
    securityHeaders(res);
    if (req.method === 'OPTIONS') { res.statusCode = 204; res.end(); return; }

    try {
      const url = new URL(req.url ?? '/', 'http://localhost');
      if (req.method === 'GET' && url.pathname === '/healthz') return json(res, 200, { ok: true });

      if (req.method === 'GET' && url.pathname === '/readyz') {
        return json(res, 200, { ok: true, policies: state.policies.size, contracts: state.contracts.size });
      }

      const principal = await resolvePrincipal(req.headers.authorization);
      const parts = url.pathname.split('/').filter(Boolean);

      if (req.method === 'POST' && parts.length === 2 && parts[0] === 'v1' && parts[1] === 'policies') {
        requireRole(principal, 'policy-admin');
        const body = await readJson(req, maxBodyBytes) as PolicyVersion;
        if (body.tenantId !== principal.tenantId) throw new Error('tenant_mismatch');
        registerPolicy(state, principal, body);
        return json(res, 201, body);
      }

      if (req.method === 'POST' && parts.length === 4 && parts[0] === 'v1' && parts[1] === 'policies' && parts[3] === 'activate') {
        requireRole(principal, 'policy-admin');
        const policyId = decodeURIComponent(parts[2]);
        const body = await readJson(req, maxBodyBytes) as { version?: number };
        if (!Number.isInteger(body.version)) throw new Error('policy_version_required');
        const policy = policyFor(state, principal.tenantId, policyId, body.version);
        if (policy.status === 'retired') throw new Error('retired_policy_cannot_activate');
        return json(res, 200, activatePolicy(state, principal, policyId, body.version));
      }

      if (req.method === 'POST' && parts.length === 2 && parts[0] === 'v1' && parts[1] === 'contracts') {
        requireRole(principal, 'contract-admin');
        const body = await readJson(req, maxBodyBytes) as { agentId?: string; policyId?: string; policyVersion?: number; purpose?: string; expiresAt?: string };
        if (!body.agentId || !body.policyId || !Number.isInteger(body.policyVersion) || !body.purpose || !body.expiresAt) throw new Error('contract_fields_required');
        const policy = policyFor(state, principal.tenantId, body.policyId, body.policyVersion);
        const binding = issueEnterpriseContract({ principal, agentId: body.agentId, policy, purpose: body.purpose, expiresAt: body.expiresAt });
        state.contracts.set(`${principal.tenantId}:${binding.contract.contractId}`, binding);
        return json(res, 201, binding);
      }

      if (req.method === 'POST' && parts.length === 2 && parts[0] === 'v1' && parts[1] === 'check') {
        const body = await readJson(req, maxBodyBytes) as { contractId?: string; correlationId?: string; request?: any };
        if (!body.contractId || !body.request) throw new Error('check_fields_required');
        const binding = state.contracts.get(`${principal.tenantId}:${body.contractId}`);
        if (!binding) throw new Error('contract_not_found');
        const event = authorize(state, principal, body.correlationId ?? `corr_${randomUUID()}`, binding, body.request);
        return json(res, 200, event);
      }

      if (req.method === 'POST' && parts.length === 3 && parts[0] === 'v1' && parts[1] === 'revocations' && parts[2] === 'contract') {
        requireRole(principal, 'security-admin');
        const body = await readJson(req, maxBodyBytes) as { contractId?: string };
        if (!body.contractId) throw new Error('contract_id_required');
        if (!state.contracts.has(`${principal.tenantId}:${body.contractId}`)) throw new Error('contract_not_found');
        revokeContract(state, principal, body.contractId);
        return json(res, 200, { revoked: true, contractId: body.contractId });
      }

      return json(res, 404, { error: 'not_found' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'internal_error';
      const status = message === 'forbidden' ? 403 : message === 'not_found' ? 404 : message.includes('jwt_') || message.includes('bearer') ? 401 : message === 'tenant_mismatch' ? 403 : message === 'request_too_large' ? 413 : 400;
      return json(res, status, { error: message });
    }
  });
}
