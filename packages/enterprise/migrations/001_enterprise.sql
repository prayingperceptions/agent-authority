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
