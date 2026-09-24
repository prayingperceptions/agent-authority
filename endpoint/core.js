import { generateKeyPairSync, createPrivateKey, createPublicKey, sign, verify, randomUUID } from 'node:crypto';
import * as crypto from 'node:crypto';
export function calculateAuthorityScore(args) {
    const now = args.now ?? new Date();
    const findings = [];
    const caps = args.contract.capabilities;
    const actionCount = caps.reduce((n, c) => n + c.actions.length, 0);
    const sensitiveActions = caps.flatMap(c => c.actions.map(action => ({ resource: c.resource, action })))
        .filter(({ action }) => /^(write|send|delete|transfer|execute|deploy|publish|merge|charge|withdraw|approve)/i.test(action));
    const approvals = new Set(args.contract.approvals?.requiredFor ?? []);
    const add = (f) => findings.push(f);
    if (caps.some(c => ['shell', 'process', 'os'].includes(c.resource))) {
        add({ id: 'execution-capability', severity: 'critical', points: -30, title: 'Process execution authority', rationale: 'The contract grants local process or shell execution.' });
    }
    if (caps.some(c => c.resource === 'network' && !c.constraints)) {
        add({ id: 'unrestricted-network', severity: 'high', points: -20, title: 'Unrestricted network authority', rationale: 'Network access is granted without destination constraints.' });
    }
    if (caps.some(c => ['payments', 'treasury', 'wallet', 'finance'].includes(c.resource) && !c.constraints)) {
        add({ id: 'financial-authority', severity: 'critical', points: -25, title: 'Unbounded financial authority', rationale: 'Financial capabilities are present without explicit limits.' });
    }
    if (caps.some(c => ['secrets', 'credentials', 'tokens', 'private_keys'].includes(c.resource))) {
        add({ id: 'secret-access', severity: 'critical', points: -20, title: 'Secret or credential access', rationale: 'The contract grants direct authority over secret material.' });
    }
    if (sensitiveActions.length > 0) {
        const unapproved = sensitiveActions.filter(({ resource, action }) => !approvals.has(`${resource}:${action}`));
        if (unapproved.length) {
            add({ id: 'unapproved-sensitive-actions', severity: 'high', points: -15, title: 'Sensitive actions without approval', rationale: `${unapproved.length} mutating or high-impact action(s) do not explicitly require approval.` });
        }
        else {
            add({ id: 'approval-boundary', severity: 'positive', points: 10, title: 'Human approval boundary', rationale: 'Sensitive actions are explicitly approval-gated.' });
        }
    }
    if (caps.some(c => c.actions.some(a => /^(delegate|spawn-agent|create-agent)/i.test(a)))) {
        add({ id: 'delegation-capability', severity: 'high', points: -15, title: 'Delegation authority', rationale: 'The agent may create or delegate to another agent and therefore needs bounded downstream authority.' });
    }
    if (caps.length > 8 || actionCount > 20) {
        add({ id: 'broad-capability-set', severity: 'medium', points: -10, title: 'Broad capability set', rationale: 'The contract grants many distinct capabilities or actions.' });
    }
    if (caps.every(c => c.constraints && Object.keys(c.constraints).length > 0)) {
        add({ id: 'constrained-capabilities', severity: 'positive', points: 8, title: 'Constrained capabilities', rationale: 'Every capability has explicit input or resource constraints.' });
    }
    const ttl = new Date(args.contract.expiresAt).getTime() - now.getTime();
    if (Number.isFinite(ttl)) {
        if (ttl <= 24 * 60 * 60 * 1000 && ttl > 0) {
            add({ id: 'short-lived-contract', severity: 'positive', points: 8, title: 'Short-lived authority', rationale: 'Contract authority expires within 24 hours.' });
        }
        else if (ttl > 30 * 24 * 60 * 60 * 1000) {
            add({ id: 'long-lived-contract', severity: 'medium', points: -10, title: 'Long-lived authority', rationale: 'Contract authority lasts longer than 30 days.' });
        }
    }
    if (args.passport.expiresAt) {
        add({ id: 'expiring-passport', severity: 'positive', points: 5, title: 'Expiring Passport', rationale: 'Agent identity has an expiration time.' });
    }
    else {
        add({ id: 'non-expiring-passport', severity: 'low', points: -3, title: 'Non-expiring Passport', rationale: 'Agent identity has no expiration time.' });
    }
    let score = 100 + findings.reduce((n, f) => n + f.points, 0);
    score = Math.max(0, Math.min(100, score));
    const grade = score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 70 ? 'C' : score >= 60 ? 'D' : 'F';
    findings.sort((a, b) => a.points - b.points || a.id.localeCompare(b.id));
    return { version: '0.1', score, grade, findings };
}
export function authorityScoreMarkdown(result) {
    const lines = [`## Authority Score: ${result.score}/100 (${result.grade})`, '', '| Severity | Finding | Points |', '| --- | --- | ---: |'];
    for (const f of result.findings)
        lines.push(`| ${f.severity} | ${f.title} | ${f.points > 0 ? '+' : ''}${f.points} |`);
    return lines.join('\n');
}
export function generateAgentKeypair() {
    const { publicKey, privateKey } = generateKeyPairSync('ed25519');
    return {
        publicKeyJwk: publicKey.export({ format: 'jwk' }),
        privateKeyJwk: privateKey.export({ format: 'jwk' })
    };
}
export function createPassport(args) {
    return {
        version: '0.1',
        passportId: `passport_${randomUUID()}`,
        agentId: args.agentId ?? `agent_${randomUUID()}`,
        issuer: args.issuer,
        subject: args.subject ?? args.issuer,
        createdAt: new Date().toISOString(),
        expiresAt: args.expiresAt,
        publicKeyJwk: args.publicKeyJwk,
        metadata: args.metadata
    };
}
export function signPassport(passport, privateKeyJwk) {
    return signEnvelope(passport, privateKeyJwk, passport.agentId);
}
export function verifyPassport(passport, signedPassport) {
    return digest(signedPassport.payload) === digest(passport) &&
        signedPassport.payload.publicKeyJwk !== undefined &&
        verifyEnvelope(signedPassport, passport.publicKeyJwk);
}
export function signContract(contract, issuerPrivateKeyJwk) {
    return signEnvelope(contract, issuerPrivateKeyJwk, contract.issuer);
}
export function signDelegation(delegation, issuerPrivateKeyJwk) {
    return signEnvelope(delegation, issuerPrivateKeyJwk, delegation.issuer);
}
export function verifySignedDelegation(delegation, signedDelegation, issuerPublicKeyJwk) {
    return digest(signedDelegation.payload) === digest(delegation) && verifyEnvelope(signedDelegation, issuerPublicKeyJwk);
}
export function verifySignedContract(contract, signedContract, issuerPublicKeyJwk) {
    return digest(signedContract.payload) === digest(contract) &&
        verifyEnvelope(signedContract, issuerPublicKeyJwk);
}
export function createContract(args) {
    return { version: '0.1', contractId: `contract_${randomUUID()}`, createdAt: new Date().toISOString(), ...args };
}
export function createDelegation(args) {
    return { version: '0.1', delegationId: `delegation_${randomUUID()}`, nonce: randomUUID(), ...args };
}
function privateKeyFromJwk(jwk) {
    return createPrivateKey({ key: jwk, format: 'jwk' });
}
function publicKeyFromJwk(jwk) {
    return createPublicKey({ key: jwk, format: 'jwk' });
}
function canonicalize(value) {
    if (value === null || typeof value !== 'object')
        return JSON.stringify(value);
    if (Array.isArray(value))
        return `[${value.map(canonicalize).join(',')}]`;
    const record = value;
    return `{${Object.keys(record).sort().map(k => `${JSON.stringify(k)}:${canonicalize(record[k])}`).join(',')}}`;
}
export function digest(payload) {
    return crypto.createHash('sha256').update(canonicalize(payload), 'utf8').digest('hex');
}
export function signEnvelope(payload, privateKeyJwk, signer) {
    const bytes = Buffer.from(canonicalize(payload), 'utf8');
    const signature = sign(null, bytes, privateKeyFromJwk(privateKeyJwk)).toString('base64url');
    return { payload, signature, algorithm: 'Ed25519', signer };
}
export function verifyEnvelope(envelope, publicKeyJwk) {
    try {
        return verify(null, Buffer.from(canonicalize(envelope.payload), 'utf8'), publicKeyFromJwk(publicKeyJwk), Buffer.from(envelope.signature, 'base64url'));
    }
    catch {
        return false;
    }
}
function isActive(createdAt, expiresAt, now) {
    const created = new Date(createdAt).getTime();
    const expires = new Date(expiresAt).getTime();
    return Number.isFinite(created) && Number.isFinite(expires) && now.getTime() >= created && now.getTime() <= expires;
}
function constraintsMatch(constraints, input) {
    if (!constraints)
        return true;
    if (!input)
        return false;
    return Object.entries(constraints).every(([key, expected]) => {
        const actual = input[key];
        if (Array.isArray(expected))
            return expected.includes(actual);
        if (expected && typeof expected === 'object' && typeof actual === 'object' && actual !== null) {
            return Object.entries(expected).every(([nested, value]) => actual[nested] === value);
        }
        return actual === expected;
    });
}
export function evaluate(contract, request, now = new Date()) {
    if (contract.subjectAgentId !== request.agentId)
        return { decision: 'deny', reasons: ['Agent identity does not match contract subject.'] };
    if (!isActive(contract.createdAt, contract.expiresAt, now))
        return { decision: 'deny', reasons: ['Contract is not active.'] };
    const capability = contract.capabilities.find(c => c.resource === request.resource &&
        c.actions.includes(request.action) &&
        constraintsMatch(c.constraints, request.input));
    if (!capability)
        return { decision: 'deny', reasons: ['No matching capability or constraints were not satisfied.'] };
    if (contract.approvals?.requiredFor.includes(`${request.resource}:${request.action}`)) {
        return { decision: 'ask', matchedCapability: capability, reasons: ['Contract explicitly requires human approval.'] };
    }
    return { decision: capability.decision ?? 'allow', matchedCapability: capability, reasons: [`Matched capability ${request.resource}:${request.action}.`] };
}
export function canDelegate(parent, requested) {
    return requested.every(child => {
        const p = parent.find(x => x.resource === child.resource);
        if (!p || child.actions.some(action => !p.actions.includes(action)))
            return false;
        if (child.decision === 'allow' && p.decision && p.decision !== 'allow')
            return false;
        if (child.constraints && !constraintsSubset(p.constraints, child.constraints))
            return false;
        return true;
    });
}
function constraintsSubset(parent, child) {
    if (!parent)
        return true;
    return Object.entries(child).every(([key, value]) => {
        if (!(key in parent))
            return false;
        const parentValue = parent[key];
        if (Array.isArray(parentValue))
            return Array.isArray(value) && value.every(v => parentValue.includes(v));
        if (parentValue && typeof parentValue === 'object' && value && typeof value === 'object') {
            return constraintsSubset(parentValue, value);
        }
        return parentValue === value;
    });
}
export function intersectCapabilities(a, b) {
    return a.flatMap(left => {
        const right = b.find(x => x.resource === left.resource);
        const actions = right ? left.actions.filter(action => right.actions.includes(action)) : [];
        return actions.length ? [{ resource: left.resource, actions }] : [];
    });
}
export function createApprovalRequest(args) {
    if (args.event.decision !== 'ask')
        throw new Error('Approval request requires an event with decision=ask.');
    const maxExpiry = new Date(args.contract.expiresAt).getTime();
    const requestedExpiry = (args.expiresAt ?? new Date(Date.now() + 5 * 60 * 1000)).getTime();
    const expiry = new Date(Math.min(maxExpiry, requestedExpiry));
    return {
        version: '0.1',
        approvalId: `approval_${randomUUID()}`,
        contractId: args.contract.contractId,
        eventId: args.event.eventId,
        requestedBy: args.requestedBy,
        createdAt: new Date().toISOString(),
        expiresAt: expiry.toISOString(),
        nonce: randomUUID(),
        actionDigest: digest(args.event.request),
        purpose: args.contract.purpose
    };
}
export function createApprovalReceipt(args) {
    return {
        version: '0.1',
        approvalId: args.request.approvalId,
        eventId: args.request.eventId,
        contractId: args.request.contractId,
        agentId: args.agentId,
        approvedBy: args.approvedBy,
        approvedAt: (args.approvedAt ?? new Date()).toISOString(),
        decision: args.decision,
        reason: args.reason,
        actionDigest: args.request.actionDigest
    };
}
export function verifyApprovalReceipt(args) {
    const now = args.now ?? new Date();
    const expires = new Date(args.request.expiresAt).getTime();
    const created = new Date(args.request.createdAt).getTime();
    return args.receipt.version === '0.1' &&
        args.receipt.decision === 'approved' &&
        args.receipt.approvalId === args.request.approvalId &&
        args.receipt.eventId === args.request.eventId &&
        args.receipt.contractId === args.request.contractId &&
        args.receipt.agentId === args.event.agentId &&
        args.request.requestedBy === args.event.agentId &&
        args.request.contractId === args.event.contractId &&
        Boolean(args.request.eventId) &&
        args.receipt.actionDigest === args.request.actionDigest &&
        args.request.actionDigest === digest(args.event.request) &&
        Number.isFinite(created) && Number.isFinite(expires) && now.getTime() >= created && now.getTime() <= expires &&
        new Date(args.receipt.approvedAt).getTime() >= created && new Date(args.receipt.approvedAt).getTime() <= expires;
}
export class InMemoryAuthorityStateStore {
    revoked = new Set();
    consumedApprovals = new Set();
    isRevoked(id) { return this.revoked.has(id); }
    revoke(id) { this.revoked.add(id); }
    consumeApproval(approvalId) {
        if (this.consumedApprovals.has(approvalId))
            return false;
        this.consumedApprovals.add(approvalId);
        return true;
    }
}
export function createAuditEvent(contract, request, result, timestamp = new Date()) {
    return {
        version: '0.1',
        eventId: `event_${randomUUID()}`,
        timestamp: timestamp.toISOString(),
        agentId: request.agentId,
        contractId: contract.contractId,
        request,
        decision: result.decision,
        reasons: result.reasons
    };
}
export function evaluateWithAudit(args) {
    const result = evaluate(args.contract, args.request, args.now);
    const event = createAuditEvent(args.contract, args.request, result, args.now ?? new Date());
    const signedEvent = args.auditPrivateKeyJwk && args.auditSigner
        ? signEnvelope(event, args.auditPrivateKeyJwk, args.auditSigner)
        : undefined;
    return { ...result, event, signedEvent };
}
export function validatePassport(passport, now = new Date()) {
    const errors = [];
    if (passport.version !== '0.1')
        errors.push('Unsupported Passport version.');
    if (!passport.passportId)
        errors.push('Missing passportId.');
    if (!passport.agentId)
        errors.push('Missing agentId.');
    if (!passport.issuer)
        errors.push('Missing issuer.');
    if (!passport.subject)
        errors.push('Missing subject.');
    if (!passport.publicKeyJwk)
        errors.push('Missing public key.');
    else if (passport.publicKeyJwk.kty !== 'OKP' || passport.publicKeyJwk.crv !== 'Ed25519' || typeof passport.publicKeyJwk.x !== 'string')
        errors.push('Passport public key must be an Ed25519 JWK.');
    const created = new Date(passport.createdAt);
    if (!Number.isFinite(created.getTime()))
        errors.push('Invalid createdAt.');
    if (passport.expiresAt) {
        const expires = new Date(passport.expiresAt);
        if (!Number.isFinite(expires.getTime()))
            errors.push('Invalid expiresAt.');
        else if (expires.getTime() < now.getTime())
            errors.push('Passport is expired.');
    }
    return errors;
}
export function validateContract(contract, now = new Date()) {
    const errors = [];
    if (contract.version !== '0.1')
        errors.push('Unsupported Contract version.');
    if (!contract.contractId)
        errors.push('Missing contractId.');
    if (!contract.subjectAgentId)
        errors.push('Missing subjectAgentId.');
    if (!contract.issuer)
        errors.push('Missing issuer.');
    if (!contract.purpose)
        errors.push('Missing purpose.');
    if (!isActive(contract.createdAt, contract.expiresAt, now))
        errors.push('Contract is not active.');
    if (!contract.capabilities.length)
        errors.push('Contract has no capabilities.');
    for (const capability of contract.capabilities) {
        if (!capability.resource)
            errors.push('Capability missing resource.');
        if (!capability.actions.length)
            errors.push(`Capability ${capability.resource} has no actions.`);
    }
    return errors;
}
export function authorityEventToLedgerReceipt(options) {
    const start = options.startTime ?? options.event.timestamp;
    const end = options.endTime ?? options.event.timestamp;
    const approvalStatus = options.approvalStatus ?? (options.event.decision === 'ask' ? 'pending' : 'not_required');
    const status = options.event.decision === 'deny' ? 'blocked' : options.event.decision === 'ask' && approvalStatus !== 'approved' ? 'approval_required' : 'completed';
    const receiptBase = {
        schema_version: 'receipt-v1',
        receipt_id: options.receiptId ?? ('receipt_' + options.event.eventId),
        agent: {
            agent_id: options.event.agentId,
            passport_id: options.passport.passportId,
            name: options.agentName,
            version: options.agentVersion,
            framework: options.framework,
            repository_url: options.repositoryUrl
        },
        run: { start_time: start, end_time: end, status, purpose: options.contract.purpose, environment: 'local' },
        execution: { model_provider: options.modelProvider, model: options.model, step_count: options.stepCount ?? 1, retry_count: options.retryCount ?? 0, human_approval_status: approvalStatus },
        tools: options.tools ?? [{ name: options.event.request.resource, invocationCount: 1, resultStatus: 'unknown' }],
        sources: options.sources ?? [],
        policy: { policy_version: options.policyVersion, decisions: [{ decision: options.event.decision, event_id: options.event.eventId, resource: options.event.request.resource, action: options.event.request.action, reasons: options.event.reasons }], violations: options.policyViolations ?? (options.event.decision === 'deny' ? options.event.reasons : []) },
        cost: { currency: options.cost?.currency ?? 'USD', ...options.cost },
        redaction: { occurred: Boolean(options.redactedFields?.length), fields_removed: options.redactedFields ?? [] },
        integrity: { input_hash: options.inputHash, output_hash: options.outputHash, receipt_hash: '', hash_algorithm: 'SHA-256', authority_event_hash: options.authorityEvent ? digest(options.authorityEvent.payload) : undefined },
        errors: options.errors ?? [],
        metadata: options.metadata
    };
    return { ...receiptBase, integrity: { ...receiptBase.integrity, receipt_hash: digest(receiptBase) } };
}
export function createLedgerEvidenceBundle(options) {
    return { version: '0.1', receipt: authorityEventToLedgerReceipt(options), authorityEvent: options.authorityEvent, approvalRequest: options.approvalRequest, approvalReceipt: options.approvalReceipt, signedApprovalReceipt: options.signedApprovalReceipt };
}
export function verifyLedgerReceipt(receipt) {
    const expected = receipt.integrity.receipt_hash;
    const { receipt_hash: _ignored, ...rest } = receipt.integrity;
    return expected === digest({ ...receipt, integrity: { ...rest, receipt_hash: '' } });
}
export class AuthorityGate {
    audit;
    stateStore;
    trustedIssuers;
    constructor(options) {
        this.audit = options?.privateKeyJwk && options.signer ? { privateKeyJwk: options.privateKeyJwk, signer: options.signer } : undefined;
        this.stateStore = options?.stateStore ?? new InMemoryAuthorityStateStore();
        this.trustedIssuers = options?.trustedIssuers ?? {};
    }
    check(contract, request, now = new Date()) {
        return this.checkInternal(contract, request, now);
    }
    checkAuthenticated(args) {
        const now = args.now ?? new Date();
        const failures = [];
        failures.push(...validatePassport(args.passport, now));
        if (!verifyPassport(args.passport, args.signedPassport))
            failures.push('Passport signature could not be verified.');
        if (args.signedContract) {
            const issuerKey = this.trustedIssuers[args.contract.issuer];
            if (!issuerKey || !verifySignedContract(args.contract, args.signedContract, issuerKey))
                failures.push('Contract issuer signature could not be verified.');
        }
        else {
            failures.push('Signed Contract is required for authenticated evaluation.');
        }
        if (this.stateStore.isRevoked(args.passport.passportId))
            failures.push('Passport is revoked.');
        if (this.stateStore.isRevoked(args.contract.contractId))
            failures.push('Contract is revoked.');
        if (args.request.agentId !== args.passport.agentId || args.contract.subjectAgentId !== args.passport.agentId)
            failures.push('Agent identity does not match Passport and Contract.');
        if (failures.length) {
            const result = { decision: 'deny', reasons: failures };
            const event = createAuditEvent(args.contract, args.request, result, now);
            return { ...result, event, signedEvent: this.audit ? signEnvelope(event, this.audit.privateKeyJwk, this.audit.signer) : undefined };
        }
        return this.checkInternal(args.contract, args.request, now);
    }
    checkApproved(args) {
        const now = args.now ?? new Date();
        const base = this.checkInternal(args.contract, args.request, now);
        if (base.decision !== 'ask')
            return { ...base, reasons: [...base.reasons, 'An approval receipt is only valid for an action that currently requires approval.'] };
        if (!verifyApprovalReceipt({ receipt: args.approvalReceipt, request: args.approvalRequest, event: base.event, now })) {
            return this.overrideDecision(args.contract, base, 'Approval receipt failed validation or expired.');
        }
        if (args.signedApprovalReceipt && args.approverPublicKeyJwk && !verifyEnvelope(args.signedApprovalReceipt, args.approverPublicKeyJwk)) {
            return this.overrideDecision(args.contract, base, 'Signed approval receipt could not be verified.');
        }
        if (!this.stateStore.consumeApproval(args.approvalRequest.approvalId)) {
            return this.overrideDecision(args.contract, base, 'Approval receipt has already been consumed.');
        }
        return { ...base, decision: 'allow', reasons: [...base.reasons, 'Valid approval receipt consumed for this exact action.'], event: createAuditEvent(args.contract, args.request, { decision: 'allow', matchedCapability: base.matchedCapability, reasons: [...base.reasons, 'Valid approval receipt consumed for this exact action.'] }, now) };
    }
    revoke(id) { this.stateStore.revoke(id); }
    checkInternal(contract, request, now) {
        const contractErrors = validateContract(contract, now);
        if (contractErrors.length) {
            const result = { decision: 'deny', reasons: contractErrors };
            const event = createAuditEvent(contract, request, result, now);
            return { ...result, event, signedEvent: this.audit ? signEnvelope(event, this.audit.privateKeyJwk, this.audit.signer) : undefined };
        }
        return evaluateWithAudit({ contract, request, now, auditPrivateKeyJwk: this.audit?.privateKeyJwk, auditSigner: this.audit?.signer });
    }
    overrideDecision(contract, base, reason) {
        const result = { decision: 'deny', matchedCapability: base.matchedCapability, reasons: [...base.reasons, reason] };
        const event = createAuditEvent(contract, base.event.request, result);
        return { ...result, event, signedEvent: this.audit ? signEnvelope(event, this.audit.privateKeyJwk, this.audit.signer) : undefined };
    }
}
