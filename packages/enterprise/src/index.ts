import { randomUUID } from 'node:crypto';
import type { AgentContract, ActionRequest, Capability, Decision } from 'agent-authority-core';
import { createContract, evaluate, digest } from 'agent-authority-core';

export interface EnterprisePrincipal {
  tenantId: string;
  subject: string;
  roles: string[];
}

export interface EnterpriseActionRequest extends ActionRequest {
  nonce: string;
}

export interface PolicyVersion {
  policyId: string;
  version: number;
  tenantId: string;
  status: 'draft' | 'active' | 'retired';
  capabilities: Capability[];
  createdBy: string;
  createdAt: string;
  activatedAt?: string;
}

export interface EnterpriseContract {
  contract: AgentContract;
  tenantId: string;
  policyId: string;
  policyVersion: number;
}

export interface AuthorizationEvent {
  eventId: string;
  correlationId: string;
  tenantId: string;
  contractId: string;
  policyId: string;
  policyVersion: number;
  actionDigest: string;
  request: ActionRequest;
  decision: Decision;
  reasons: string[];
  createdAt: string;
}

export interface EnterpriseState {
  policies: Map<string, PolicyVersion>;
  contracts: Map<string, EnterpriseContract>;
  nonces: Set<string>;
  revoked: Set<string>;
}

export function createEnterpriseState(): EnterpriseState {
  return { policies: new Map(), contracts: new Map(), nonces: new Set(), revoked: new Set() };
}

export function createPolicy(args: Omit<PolicyVersion, 'createdAt' | 'status'> & { version?: number }): PolicyVersion {
  return {
    ...args,
    version: args.version ?? 1,
    status: 'draft',
    createdAt: new Date().toISOString()
  };
}

export function activatePolicy(state: EnterpriseState, principal: EnterprisePrincipal, policyId: string, version: number): PolicyVersion {
  const key = `${principal.tenantId}:${policyId}:${version}`;
  const policy = state.policies.get(key);
  if (!policy) throw new Error('policy_not_found');
  for (const p of state.policies.values()) {
    if (p.tenantId === principal.tenantId && p.policyId === policyId && p.status === 'active') p.status = 'retired';
  }
  policy.status = 'active';
  policy.activatedAt = new Date().toISOString();
  return policy;
}

export function registerPolicy(state: EnterpriseState, principal: EnterprisePrincipal, policy: PolicyVersion): void {
  if (policy.tenantId !== principal.tenantId) throw new Error('tenant_mismatch');
  const key = `${policy.tenantId}:${policy.policyId}:${policy.version}`;
  if (state.policies.has(key)) throw new Error('policy_version_immutable');
  if (policy.status !== 'draft') throw new Error('policy_must_start_as_draft');
  state.policies.set(key, structuredClone(policy));
}

export function issueEnterpriseContract(args: {
  principal: EnterprisePrincipal;
  agentId: string;
  policy: PolicyVersion;
  purpose: string;
  expiresAt: string;
}): EnterpriseContract {
  if (args.policy.tenantId !== args.principal.tenantId || args.policy.status !== 'active') throw new Error('active_policy_required');
  const contract = createContract({
    subjectAgentId: args.agentId,
    issuer: args.principal.subject,
    purpose: args.purpose,
    expiresAt: args.expiresAt,
    capabilities: args.policy.capabilities
  });
  return { contract, tenantId: args.principal.tenantId, policyId: args.policy.policyId, policyVersion: args.policy.version };
}

export function authorize(state: EnterpriseState, principal: EnterprisePrincipal, correlationId: string, binding: EnterpriseContract, request: EnterpriseActionRequest): AuthorizationEvent {
  if (binding.tenantId !== principal.tenantId) return deny(correlationId, principal.tenantId, binding, coreRequest(request), ['Tenant context does not match.']);
  if (state.revoked.has(`${principal.tenantId}:${binding.contract.contractId}`)) return deny(correlationId, principal.tenantId, binding, coreRequest(request), ['Contract is revoked.']);
  if (binding.contract.subjectAgentId !== request.agentId) return deny(correlationId, principal.tenantId, binding, coreRequest(request), ['Agent identity does not match contract subject.']);
  const expires = Date.parse(binding.contract.expiresAt);
  if (!Number.isFinite(expires) || expires < Date.now()) return deny(correlationId, principal.tenantId, binding, coreRequest(request), ['Contract is expired or invalid.']);
  if (request.nonce.length < 16 || request.nonce.length > 256) return deny(correlationId, principal.tenantId, binding, coreRequest(request), ['Nonce length is outside accepted bounds.']);
  const nonceKey = `${principal.tenantId}:${request.nonce}`;
  if (state.nonces.has(nonceKey)) return deny(correlationId, principal.tenantId, binding, coreRequest(request), ['Action nonce has already been consumed.']);
  state.nonces.add(nonceKey);

  const evaluatedRequest = coreRequest(request);
  const result = evaluate(binding.contract, evaluatedRequest);
  return {
    eventId: `event_${randomUUID()}`,
    correlationId,
    tenantId: principal.tenantId,
    contractId: binding.contract.contractId,
    policyId: binding.policyId,
    policyVersion: binding.policyVersion,
    actionDigest: digest(evaluatedRequest),
    request: evaluatedRequest,
    decision: result.decision,
    reasons: result.reasons,
    createdAt: new Date().toISOString()
  };
}

export function revokeContract(state: EnterpriseState, principal: EnterprisePrincipal, contractId: string): void {
  state.revoked.add(`${principal.tenantId}:${contractId}`);
}

function coreRequest(request: EnterpriseActionRequest): ActionRequest {
  return { agentId: request.agentId, resource: request.resource, action: request.action, input: request.input };
}

function deny(correlationId: string, tenantId: string, binding: EnterpriseContract, request: ActionRequest, reasons: string[]): AuthorizationEvent {
  return { eventId:`event_${randomUUID()}`, correlationId, tenantId, contractId:binding.contract.contractId, policyId:binding.policyId, policyVersion:binding.policyVersion, actionDigest:digest(request), request, decision:'deny', reasons, createdAt:new Date().toISOString() };
}
