import type { Pool } from 'pg';
import type { EnterpriseContract, EnterpriseState, PolicyVersion } from './index.js';

export class PostgresEnterpriseStore {
  constructor(private readonly pool: Pool) {}

  async ensureSchema(): Promise<void> {
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
      CREATE UNIQUE INDEX IF NOT EXISTS aa_enterprise_active_policy
        ON aa_enterprise_policies (tenant_id, policy_id) WHERE status='active';
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
    `);
  }

  async putPolicy(policy: PolicyVersion): Promise<void> {
    await this.pool.query(
      `INSERT INTO aa_enterprise_policies (tenant_id,policy_id,version,status,document,created_by,created_at,activated_at)
       VALUES ($1,$2,$3,'draft',$4::jsonb,$5,$6,$7)`,
      [policy.tenantId, policy.policyId, policy.version, JSON.stringify(policy), policy.createdBy, policy.createdAt, policy.activatedAt ?? null]
    );
  }

  async activatePolicy(tenantId: string, policyId: string, version: number): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`UPDATE aa_enterprise_policies SET status='retired' WHERE tenant_id=$1 AND policy_id=$2 AND status='active'`, [tenantId,policyId]);
      const r = await client.query(`UPDATE aa_enterprise_policies SET status='active', activated_at=NOW() WHERE tenant_id=$1 AND policy_id=$2 AND version=$3 RETURNING version`, [tenantId,policyId,version]);
      if (r.rowCount !== 1) throw new Error('policy_not_found');
      await client.query('COMMIT');
    } catch (e) { await client.query('ROLLBACK'); throw e; }
    finally { client.release(); }
  }

  async putContract(binding: EnterpriseContract): Promise<void> {
    await this.pool.query(
      `INSERT INTO aa_enterprise_contracts (tenant_id,contract_id,document,revoked_at) VALUES ($1,$2,$3::jsonb,$4)`,
      [binding.tenantId,binding.contract.contractId,JSON.stringify(binding),binding.contract.expiresAt]
    );
  }

  async getContract(tenantId: string, contractId: string): Promise<EnterpriseContract | undefined> {
    const r=await this.pool.query(`SELECT document FROM aa_enterprise_contracts WHERE tenant_id=$1 AND contract_id=$2`,[tenantId,contractId]);
    return r.rows[0]?.document as EnterpriseContract | undefined;
  }

  async consumeNonce(tenantId: string, nonce: string): Promise<boolean> {
    const r=await this.pool.query(`INSERT INTO aa_enterprise_nonces (tenant_id,nonce) VALUES ($1,$2) ON CONFLICT DO NOTHING`,[tenantId,nonce]);
    return r.rowCount === 1;
  }

  async putEvent(event: unknown, tenantId: string, eventId: string, correlationId: string): Promise<void> {
    await this.pool.query(`INSERT INTO aa_enterprise_events (tenant_id,event_id,correlation_id,document,created_at) VALUES ($1,$2,$3,$4::jsonb,NOW())`,[tenantId,eventId,correlationId,JSON.stringify(event)]);
  }

  async snapshot(state: EnterpriseState, tenantId: string): Promise<void> {
    for (const p of state.policies.values()) if (p.tenantId===tenantId) {
      await this.pool.query(`INSERT INTO aa_enterprise_policies (tenant_id,policy_id,version,status,document,created_by,created_at,activated_at) VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8) ON CONFLICT DO NOTHING`,[p.tenantId,p.policyId,p.version,p.status,JSON.stringify(p),p.createdBy,p.createdAt,p.activatedAt ?? null]);
    }
  }
}