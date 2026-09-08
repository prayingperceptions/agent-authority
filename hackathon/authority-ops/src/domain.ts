export type Decision = 'allow' | 'ask' | 'deny';

export interface Capability {
  resource: string;
  actions: string[];
  constraints?: Record<string, unknown>;
  decision?: Decision;
}

export interface AgentPassport {
  version: '0.1';
  passportId: string;
  agentId: string;
  issuer: string;
  expiresAt: string;
}

export interface AgentContract {
  version: '0.1';
  contractId: string;
  subjectAgentId: string;
  issuer: string;
  purpose: string;
  createdAt: string;
  expiresAt: string;
  capabilities: Capability[];
  approvals?: { requiredFor: string[] };
}

export interface ActionRequest {
  agentId: string;
  resource: string;
  action: string;
  input?: Record<string, unknown>;
}

export interface GateResult {
  decision: Decision;
  reasons: string[];
  matchedCapability?: Capability;
}

export interface Invoice {
  invoiceId: string;
  vendorId: string;
  vendorName: string;
  amount: number;
  currency: 'USD';
  description: string;
  source: string;
}

export interface ToolInvocation {
  name: string;
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
  resultStatus: 'success' | 'failure' | 'blocked' | 'unknown';
}
