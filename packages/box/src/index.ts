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
} from '@jubileelabs/agent-authority-core';

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
}

export interface BoxRunSummary {
  boxId: string;
  agentId: string;
  contractId: string;
  actions: number;
  blocked: number;
  approvalRequired: number;
  failed: number;
  completed: number;
  startedAt: string;
  endedAt?: string;
}

export interface AgentBoxOptions {
  passport: AgentPassport;
  contract: AgentContract;
  gate?: AuthorityGate;
  limits?: BoxLimits;
  agentName?: string;
  framework?: string;
  workspaceDir?: string;
}

export class AgentBox {
  readonly boxId = `box_${randomUUID()}`;
  private readonly startedAt = new Date().toISOString();
  private readonly gates: AuthorityGate;
  private readonly toolEvents: LedgerToolEvent[] = [];
  private blocked = 0;
  private approvalRequired = 0;
  private failed = 0;
  private completed = 0;
  private endedAt?: string;
  private workspaceDir?: string;

  constructor(private readonly options: AgentBoxOptions) {
    this.gates = options.gate ?? new AuthorityGate();
  }

  request(action: BoxAction): GateResult {
    return this.gates.check(this.options.contract, {
      agentId: this.options.passport.agentId,
      resource: action.resource,
      action: action.action,
      input: action.input,
    });
  }

  async execute<T>(
    action: BoxAction,
    executor: () => Promise<T> | T,
  ): Promise<BoxExecutionResult<T>> {
    const gate = this.request(action);

    if (gate.decision === 'deny') {
      this.blocked++;
      this.recordTool(action, 'failure');
      return this.result<T>('blocked', gate);
    }

    if (gate.decision === 'ask') {
      this.approvalRequired++;
      this.recordTool(action, 'unknown');
      return this.result<T>('approval_required', gate);
    }

    if (action.kind === 'network' && this.options.limits?.network === 'deny') {
      const networkGate = { ...gate, decision: 'deny' as const, reasons: [...gate.reasons, 'Box network policy denies outbound network access.'] };
      this.blocked++;
      this.recordTool(action, 'failure');
      return this.result<T>('blocked', networkGate);
    }

    try {
      const value = await this.withTimeout(Promise.resolve(executor()), this.options.limits?.timeoutMs ?? 30_000);
      this.completed++;
      this.recordTool(action, 'success');
      return this.result('completed', gate, value);
    } catch (error) {
      this.failed++;
      this.recordTool(action, 'failure');
      return this.result<T>('failed', gate, undefined, error instanceof Error ? error.message : String(error));
    }
  }

  async runProcess(command: string, args: string[] = [], input?: Record<string, unknown>): Promise<BoxExecutionResult<{ stdout: string; stderr: string; code: number | null }>> {
    const actionInput = { command, args, ...input };
    return this.execute(
      { kind: 'process', resource: 'process', action: 'execute', input: actionInput },
      () => this.spawnProcess(command, args),
    );
  }

  async runFilesystem<T>(resource: string, action: string, input: Record<string, unknown>, executor: () => Promise<T> | T): Promise<BoxExecutionResult<T>> {
    return this.execute({ kind: 'filesystem', resource, action, input }, executor);
  }

  async runNetwork<T>(resource: string, action: string, input: Record<string, unknown>, executor: () => Promise<T> | T): Promise<BoxExecutionResult<T>> {
    return this.execute({ kind: 'network', resource, action, input }, executor);
  }

  async runBrowser<T>(resource: string, action: string, input: Record<string, unknown>, executor: () => Promise<T> | T): Promise<BoxExecutionResult<T>> {
    return this.execute({ kind: 'browser', resource, action, input }, executor);
  }

  /**
   * Creates a temporary local workspace for the Box. This is a disposable execution
   * directory, not a hardened VM/container boundary. Use a real sandbox runtime for
   * hostile code.
   */
  async createWorkspace(prefix = 'agent-box-'): Promise<string> {
    if (this.workspaceDir) return this.workspaceDir;
    if (this.options.workspaceDir) {
      this.workspaceDir = this.options.workspaceDir;
      return this.workspaceDir;
    }
    const created = await mkdtemp(join(tmpdir(), prefix));
    this.workspaceDir = created;
    return created;
  }

  async dispose(): Promise<void> {
    if (this.workspaceDir && !this.options.workspaceDir) {
      await rm(this.workspaceDir, { recursive: true, force: true });
      this.workspaceDir = undefined;
    }
  }

  ledger(): LedgerEvidenceBundle {
    const event: AuditEvent = {
      version: '0.1',
      eventId: `event_${randomUUID()}`,
      timestamp: new Date().toISOString(),
      agentId: this.options.passport.agentId,
      contractId: this.options.contract.contractId,
      request: { agentId: this.options.passport.agentId, resource: 'box', action: 'run' },
      decision: 'allow',
      reasons: ['Aggregate Box run receipt.'],
    };
    this.endedAt ??= new Date().toISOString();
    return createLedgerEvidenceBundle({
      passport: this.options.passport,
      contract: this.options.contract,
      event,
      agentName: this.options.agentName,
      framework: this.options.framework,
      startTime: this.startedAt,
      endTime: this.endedAt,
      stepCount: this.toolEvents.length,
      tools: this.toolEvents,
      approvalStatus: this.approvalRequired ? 'pending' : 'not_required',
      metadata: { box_id: this.boxId },
    });
  }

  summary(): BoxRunSummary {
    this.endedAt ??= new Date().toISOString();
    return {
      boxId: this.boxId,
      agentId: this.options.passport.agentId,
      contractId: this.options.contract.contractId,
      actions: this.toolEvents.length,
      blocked: this.blocked,
      approvalRequired: this.approvalRequired,
      failed: this.failed,
      completed: this.completed,
      startedAt: this.startedAt,
      endedAt: this.endedAt,
    };
  }

  private recordTool(action: BoxAction, status: LedgerToolEvent['resultStatus']): void {
    const existing = this.toolEvents.find(t => t.name === `${action.kind}:${action.resource}:${action.action}`);
    if (existing) {
      existing.invocationCount += 1;
      existing.resultStatus = status;
      return;
    }
    this.toolEvents.push({ name: `${action.kind}:${action.resource}:${action.action}`, invocationCount: 1, resultStatus: status });
  }

  private result<T>(status: BoxExecutionResult<T>['status'], gate: GateResult, value?: T, error?: string): BoxExecutionResult<T> {
    return {
      status,
      value,
      error,
      gate,
      ledger: createLedgerEvidenceBundle({
        passport: this.options.passport,
        contract: this.options.contract,
        event: gate.event,
        authorityEvent: gate.signedEvent,
        agentName: this.options.agentName,
        framework: this.options.framework,
        approvalStatus: status === 'approval_required' ? 'pending' : 'not_required',
        tools: this.toolEvents,
        errors: error ? [{ message: error }] : [],
        metadata: { box_id: this.boxId },
      }),
    };
  }

  private async spawnProcess(command: string, args: string[]): Promise<{ stdout: string; stderr: string; code: number | null }> {
    const workspace = await this.createWorkspace();
    const requestedCwd = this.options.limits?.cwd ? resolve(workspace, this.options.limits.cwd) : workspace;
    const rel = relative(workspace, requestedCwd);
    if (rel.startsWith('..') || isAbsolute(rel)) throw new Error('Box process cwd must remain inside the Box workspace.');
    const cwd = requestedCwd;
    const env = { PATH: process.env.PATH ?? '', ...(this.options.limits?.env ?? {}) };
    return new Promise((resolve, reject) => {
      const child: ChildProcess = spawn(command, args, {
        cwd,
        env,
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: false,
      });
      let stdout = '';
      let stderr = '';
      child.stdout?.on('data', (chunk: unknown) => { stdout += String(chunk); });
      child.stderr?.on('data', (chunk: unknown) => { stderr += String(chunk); });
      child.once('error', reject);
      child.once('close', (code: number | null) => {
        if (code === 0) resolve({ stdout, stderr, code });
        else reject(new Error(`Process exited with code ${code}: ${stderr || stdout}`));
      });
    });
  }

  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        promise,
        new Promise<T>((_, reject) => {
          timer = setTimeout(() => reject(new Error(`Execution timed out after ${timeoutMs}ms.`)), timeoutMs);
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}

export function createBoxFromContract(options: AgentBoxOptions): AgentBox {
  return new AgentBox(options);
}
