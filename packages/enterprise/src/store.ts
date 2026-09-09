import { createHash } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import type { ApprovalReceipt, ApprovalRequest, LedgerReceiptV1 } from 'agent-authority-core';
import type { EnterpriseContract, PolicyVersion, AuthorizationEvent } from './index.js';

export interface StoredApproval {
  tenantId: string;
  request: ApprovalRequest;
  receipt?: ApprovalReceipt;
  status: 'pending' | 'approved' | 'rejected' | 'consumed';
}

export interface StoredReceipt {
  tenantId: string;
  receipt: LedgerReceiptV1;
  eventId: string;
  actionDigest: string;
  previousReceiptHash?: string;
}

export interface EnterpriseStore {
  init(): Promise<void>;
  getPolicy(tenantId: string, policyId: string, version: number): Promise<PolicyVersion | undefined>;
  putPolicy(policy: PolicyVersion): Promise<void>;
  activatePolicy(tenantId: string, policyId: string, version: number): Promise<PolicyVersion>;
  putContract(binding: EnterpriseContract): Promise<void>;
  getContract(tenantId: string, contractId: string): Promise<EnterpriseContract | undefined>;
  revokeContract(tenantId: string, contractId: string): Promise<boolean>;
  consumeNonce(tenantId: string, nonce: string): Promise<boolean>;
  putEvent(event: AuthorizationEvent): Promise<void>;
  getEvent(tenantId: string, eventId: string): Promise<AuthorizationEvent | undefined>;
  putApproval(tenantId: string, request: ApprovalRequest): Promise<void>;
  getApproval(tenantId: string, approvalId: string): Promise<StoredApproval | undefined>;
  decideApproval(tenantId: string, approvalId: string, approvedBy: string, decision: 'approved' | 'rejected', reason?: string): Promise<StoredApproval>;
  consumeApproval(tenantId: string, approvalId: string, actionDigest: string): Promise<StoredApproval>;
  putReceipt(receipt: StoredReceipt): Promise<void>;
  getReceipt(tenantId: string, receiptId: string): Promise<StoredReceipt | undefined>;
  readiness(): Promise<{ durable: boolean }>;
}

export class InMemoryEnterpriseStore implements EnterpriseStore {
  private readonly policies = new Map<string, PolicyVersion>();
  private readonly contracts = new Map<string, EnterpriseContract>();
  private readonly nonces = new Set<string>();
  private readonly revoked = new Set<string>();
  private readonly events = new Map<string, AuthorizationEvent>();
  private readonly approvals = new Map<string, StoredApproval>();
  private readonly receipts = new Map<string, StoredReceipt>();

  async init(): Promise<void> {}
  private p(tenantId: string, policyId: string, version: number) { return `${tenantId}:${policyId}:${version}`; }
  private c(tenantId: string, contractId: string) { return `${tenantId}:${contractId}`; }

  async getPolicy(tenantId: string, policyId: string, version: number) { return this.policies.get(this.p(tenantId, policyId, version)); }
  async putPolicy(policy: PolicyVersion) {
    const key = this.p(policy.tenantId, policy.policyId, policy.version);
    if (this.policies.has(key)) throw new Error('policy_version_immutable');
    this.policies.set(key, structuredClone(policy));
  }
  async activatePolicy(tenantId: string, policyId: string, version: number) {
    const policy = this.policies.get(this.p(tenantId, policyId, version));
    if (!policy) throw new Error('policy_not_found');
    for (const p of this.policies.values()) if (p.tenantId === tenantId && p.policyId === policyId && p.status === 'active') p.status = 'retired';
    policy.status = 'active'; policy.activatedAt = new Date().toISOString();
    return policy;
  }
  async putContract(binding: EnterpriseContract) { this.contracts.set(this.c(binding.tenantId, binding.contract.contractId), structuredClone(binding)); }
  async getContract(tenantId: string, contractId: string) { if (this.revoked.has(this.c(tenantId, contractId))) return undefined; return this.contracts.get(this.c(tenantId, contractId)); }
  async revokeContract(tenantId: string, contractId: string) { const key = this.c(tenantId, contractId); if (!this.contracts.has(key)) return false; this.revoked.add(key); return true; }
  async consumeNonce(tenantId: string, nonce: string) { const key = `${tenantId}:${nonce}`; if (this.nonces.has(key)) return false; this.nonces.add(key); return true; }
  async putEvent(event: AuthorizationEvent) { this.events.set(`${event.tenantId}:${event.eventId}`, structuredClone(event)); }
  async getEvent(tenantId: string, eventId: string) { return this.events.get(`${tenantId}:${eventId}`); }
  async putApproval(tenantId: string, request: ApprovalRequest) { this.approvals.set(`${tenantId}:${request.approvalId}`, { tenantId, request: structuredClone(request), status: 'pending' }); }
  async getApproval(tenantId: string, approvalId: string) { return this.approvals.get(`${tenantId}:${approvalId}`); }
  async decideApproval(tenantId: string, approvalId: string, approvedBy: string, decision: 'approved' | 'rejected', reason?: string) {
    const record = this.approvals.get(`${tenantId}:${approvalId}`);
    if (!record) throw new Error('approval_not_found');
    if (record.status !== 'pending') throw new Error('approval_already_decided');
    if (record.request.requestedBy === approvedBy) throw new Error('separation_of_duties_violation');
    record.receipt = { version: '0.1', approvalId, eventId: record.request.eventId, contractId: record.request.contractId, agentId: '', approvedBy, approvedAt: new Date().toISOString(), decision, reason, actionDigest: record.request.actionDigest };
    record.status = decision;
    return record;
  }
  async consumeApproval(tenantId: string, approvalId: string, actionDigest: string) {
    const record = this.approvals.get(`${tenantId}:${approvalId}`);
    if (!record) throw new Error('approval_not_found');
    if (record.status !== 'approved') throw new Error('approval_not_approved');
    if (record.request.actionDigest !== actionDigest) throw new Error('approval_action_mismatch');
    record.status = 'consumed';
    return record;
  }
  async putReceipt(receipt: StoredReceipt) { if (this.receipts.has(`${receipt.tenantId}:${receipt.receipt.receipt_id}`)) throw new Error('receipt_immutable'); this.receipts.set(`${receipt.tenantId}:${receipt.receipt.receipt_id}`, structuredClone(receipt)); }
  async getReceipt(tenantId: string, receiptId: string) { return this.receipts.get(`${tenantId}:${receiptId}`); }
  async readiness() { return { durable: false }; }
}

export class PostgresEnterpriseStore implements EnterpriseStore {
  constructor(private readonly pool: Pool) {}

  async init(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS aa_enterprise_policies (
        tenant_id TEXT NOT NULL,
        policy_id TEXT NOT NULL,
        version INTEGER NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('draft','active','retired')),
        document JSONB NOT NULL,
        created_by TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL,
        activated_at TIMESTAMPTZ,
        PRIMARY KEY (tenant_id, policy_id, version)
      );
      CREATE UNIQUE INDEX IF NOT EXISTS aa_enterprise_active_policy ON aa_enterprise_policies (tenant_id, policy_id) WHERE status='active';
      CREATE TABLE IF NOT EXISTS aa_enterprise_contracts (
        tenant_id TEXT NOT NULL,
        contract_id TEXT NOT NULL,
        document JSONB NOT NULL,
        revoked_at TIMESTAMPTZ,
        PRIMARY KEY (tenant_id, contract_id)
      );
      CREATE TABLE IF NOT EXISTS aa_enterprise_nonces (
        tenant_id TEXT NOT NULL,
        nonce TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (tenant_id, nonce)
      );
      CREATE TABLE IF NOT EXISTS aa_enterprise_events (
        tenant_id TEXT NOT NULL,
        event_id TEXT NOT NULL,
        correlation_id TEXT NOT NULL,
        document JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL,
        PRIMARY KEY (tenant_id, event_id)
      );
      CREATE TABLE IF NOT EXISTS aa_enterprise_approvals (
        tenant_id TEXT NOT NULL,
        approval_id TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('pending','approved','rejected','consumed')),
        request JSONB NOT NULL,
        receipt JSONB,
        created_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL,
        PRIMARY KEY (tenant_id, approval_id)
      );
      CREATE TABLE IF NOT EXISTS aa_enterprise_receipts (
        tenant_id TEXT NOT NULL,
        receipt_id TEXT NOT NULL,
        event_id TEXT NOT NULL,
        action_digest TEXT NOT NULL,
        previous_receipt_hash TEXT,
        receipt_hash TEXT NOT NULL,
        document JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL,
        PRIMARY KEY (tenant_id, receipt_id)
      );
    `);
  }

  async getPolicy(tenantId: string, policyId: string, version: number) {
    const r = await this.pool.query('SELECT document FROM aa_enterprise_policies WHERE tenant_id=$1 AND policy_id=$2 AND version=$3', [tenantId, policyId, version]);
    return r.rows[0]?.document as PolicyVersion | undefined;
  }
  async putPolicy(policy: PolicyVersion) {
    await this.pool.query('INSERT INTO aa_enterprise_policies (tenant_id,policy_id,version,status,document,created_by,created_at,activated_at) VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8)', [policy.tenantId,policy.policyId,policy.version,policy.status,JSON.stringify(policy),policy.createdBy,policy.createdAt,policy.activatedAt ?? null]);
  }
  async activatePolicy(tenantId: string, policyId: string, version: number) {
    const client: PoolClient = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const current = await client.query('SELECT document FROM aa_enterprise_policies WHERE tenant_id=$1 AND policy_id=$2 AND version=$3 FOR UPDATE', [tenantId,policyId,version]);
      if (!current.rows[0]) throw new Error('policy_not_found');
      await client.query('UPDATE aa_enterprise_policies SET status=\'retired\' WHERE tenant_id=$1 AND policy_id=$2 AND status=\'active\'', [tenantId,policyId]);
      await client.query('UPDATE aa_enterprise_policies SET status=\'active\', activated_at=NOW(), document=jsonb_set(document,\'{status}\',\'"active"\'::jsonb) || jsonb_build_object(\'activatedAt\',NOW()) WHERE tenant_id=$1 AND policy_id=$2 AND version=$3', [tenantId,policyId,version]);
      await client.query('COMMIT');
      const updated = await this.getPolicy(tenantId,policyId,version); if (!updated) throw new Error('policy_not_found'); return updated;
    } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
  }
  async putContract(binding: EnterpriseContract) { await this.pool.query('INSERT INTO aa_enterprise_contracts (tenant_id,contract_id,document,revoked_at) VALUES ($1,$2,$3::jsonb,NULL)', [binding.tenantId,binding.contract.contractId,JSON.stringify(binding)]); }
  async getContract(tenantId: string, contractId: string) { const r=await this.pool.query('SELECT document FROM aa_enterprise_contracts WHERE tenant_id=$1 AND contract_id=$2 AND revoked_at IS NULL',[tenantId,contractId]); return r.rows[0]?.document as EnterpriseContract | undefined; }
  async revokeContract(tenantId: string, contractId: string) { const r=await this.pool.query('UPDATE aa_enterprise_contracts SET revoked_at=NOW() WHERE tenant_id=$1 AND contract_id=$2 AND revoked_at IS NULL',[tenantId,contractId]); return r.rowCount===1; }
  async consumeNonce(tenantId: string, nonce: string) { const r=await this.pool.query('INSERT INTO aa_enterprise_nonces (tenant_id,nonce) VALUES ($1,$2) ON CONFLICT DO NOTHING',[tenantId,nonce]); return r.rowCount===1; }
  async putEvent(event: AuthorizationEvent) { await this.pool.query('INSERT INTO aa_enterprise_events (tenant_id,event_id,correlation_id,document,created_at) VALUES ($1,$2,$3,$4::jsonb,NOW())',[event.tenantId,event.eventId,event.correlationId,JSON.stringify(event)]); }
  async getEvent(tenantId: string, eventId: string) { const r=await this.pool.query('SELECT document FROM aa_enterprise_events WHERE tenant_id=$1 AND event_id=$2',[tenantId,eventId]); return r.rows[0]?.document as AuthorizationEvent | undefined; }
  async putApproval(tenantId: string, request: ApprovalRequest) { await this.pool.query('INSERT INTO aa_enterprise_approvals (tenant_id,approval_id,status,request,created_at,updated_at) VALUES ($1,$2,\'pending\',$3::jsonb,NOW(),NOW())',[tenantId,request.approvalId,JSON.stringify(request)]); }
  async getApproval(tenantId: string, approvalId: string) { const r=await this.pool.query('SELECT request,receipt,status FROM aa_enterprise_approvals WHERE tenant_id=$1 AND approval_id=$2',[tenantId,approvalId]); const row=r.rows[0]; if(!row) return undefined; return {tenantId,request:row.request as ApprovalRequest,receipt:row.receipt as ApprovalReceipt | undefined,status:row.status as StoredApproval['status']}; }
  async decideApproval(tenantId: string, approvalId: string, approvedBy: string, decision: 'approved'|'rejected', reason?: string) {
    const client=await this.pool.connect();
    try { await client.query('BEGIN'); const r=await client.query('SELECT request,status FROM aa_enterprise_approvals WHERE tenant_id=$1 AND approval_id=$2 FOR UPDATE',[tenantId,approvalId]); const row=r.rows[0]; if(!row) throw new Error('approval_not_found'); if(row.status!=='pending') throw new Error('approval_already_decided'); const request=row.request as ApprovalRequest; if(request.requestedBy===approvedBy) throw new Error('separation_of_duties_violation'); const receipt={version:'0.1',approvalId,eventId:request.eventId,contractId:request.contractId,agentId:'',approvedBy,approvedAt:new Date().toISOString(),decision,reason,actionDigest:request.actionDigest} as ApprovalReceipt; await client.query('UPDATE aa_enterprise_approvals SET status=$4,receipt=$3::jsonb,updated_at=NOW() WHERE tenant_id=$1 AND approval_id=$2',[tenantId,approvalId,JSON.stringify(receipt),decision]); await client.query('COMMIT'); return {tenantId,request,receipt,status:decision as StoredApproval['status']}; } catch(e){await client.query('ROLLBACK');throw e;} finally{client.release();}
  }
  async consumeApproval(tenantId: string, approvalId: string, actionDigest: string) { const client=await this.pool.connect(); try { await client.query('BEGIN'); const r=await client.query('SELECT request,receipt,status FROM aa_enterprise_approvals WHERE tenant_id=$1 AND approval_id=$2 FOR UPDATE',[tenantId,approvalId]); const row=r.rows[0]; if(!row) throw new Error('approval_not_found'); if(row.status!=='approved') throw new Error('approval_not_approved'); const request=row.request as ApprovalRequest; if(request.actionDigest!==actionDigest) throw new Error('approval_action_mismatch'); await client.query('UPDATE aa_enterprise_approvals SET status=\'consumed\',updated_at=NOW() WHERE tenant_id=$1 AND approval_id=$2',[tenantId,approvalId]); await client.query('COMMIT'); return {tenantId,request,receipt:row.receipt as ApprovalReceipt,status:'consumed' as const}; } catch(e){await client.query('ROLLBACK');throw e;} finally{client.release();} }
  async putReceipt(receipt: StoredReceipt) { const hash=createHash('sha256').update(JSON.stringify(receipt.receipt)).digest('hex'); await this.pool.query('INSERT INTO aa_enterprise_receipts (tenant_id,receipt_id,event_id,action_digest,previous_receipt_hash,receipt_hash,document,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,NOW())',[receipt.tenantId,receipt.receipt.receipt_id,receipt.eventId,receipt.actionDigest,receipt.previousReceiptHash ?? null,hash,JSON.stringify(receipt)]); }
  async getReceipt(tenantId: string, receiptId: string) { const r=await this.pool.query('SELECT document FROM aa_enterprise_receipts WHERE tenant_id=$1 AND receipt_id=$2',[tenantId,receiptId]); return r.rows[0]?.document as StoredReceipt | undefined; }
  async readiness() { try { await this.pool.query('SELECT 1'); return {durable:true}; } catch { return {durable:false}; } }
}
