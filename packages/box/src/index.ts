import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative, resolve, isAbsolute } from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  AuthorityGate,
  createLedgerEvidenceBundle,
  type ActionRequest,
  type AgentContract,
  type AgentPassport,
  type GateResult,
  type LedgerEvidenceBundle,
  type LedgerToolEvent,
  type SignedEnvelope,
  type AuditEvent,
} from 'agent-authority-core';

export type BoxActionKind = 'process' | 'filesystem' | 'network' | 'browser';

export interface BoxAction {
  kind: BoxActionKind;
  resource: string;
  action: string;
  input?: Record<string, unknown>;
}

export interface BoxLimits {
  timeoutMs?: number;
  cwd?: string;
  env?: Record<string, string>;
  network?: 'allow' | 'deny';
}

export interface BoxExecutionResult<T = unknown> {
  status: 'completed' | 'blocked' | 'approval_required' | 'failed';
  value?: T;
  error?: string;
  gate: GateResult;
  ledger: LedgerEvidenceBundle;
