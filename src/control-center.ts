import {readSupportAdmin,supportAdminAction} from './support-admin';
import {applyContractAction} from './control-contracts';
import { readTickets, readAudit, operationQueues, applyTicketAction } from './control-operations';
import { rewardSnapshot, settleReward } from './control-rewards';
import { randomBytes, randomUUID } from 'node:crypto';
import { FieldPath, FieldValue } from 'firebase-admin/firestore';
import { db, ref, auth, hash, ApiError, type Data, type Identity } from './store';
import { requirePermission, controlRef, controlAudit, controlAccess, controlAccount } from './control-auth';
import { CONTROL_MODULES, ROLES, permissionsFor, ACTION_PERMISSIONS, CONTROL_DEFAULTS, type Permission } from '../../lib/control-center';
import { DEFAULT_PROGRAM_CONFIG, BADGES, TEAM_LEVELS } from '../../lib/programs';
import { DEFAULT_CONFIGURATION } from '../../lib/preferences';
import { marketSymbol, MARKET_SYMBOLS } from '../../lib/market-symbols';
const key = (v: unknown) => {
    if (typeof v !== 'string' || !/^[-A-Za-z0-9_]{1,128}$/.test(v))
        throw new ApiError('Invalid identifier');
    return v;
};
const text = (v: unknown, max = 500) => {
    if (typeof v !== 'string' || !v.trim() || v.length > max)
        throw new ApiError('نص مطلوب أو طويل جدًا. / Required text is invalid.');
    return v.trim();
};
const integer = (v: unknown, min = 0) => {
    if (!Number.isSafeInteger(v) || Number(v) < min || Number(v) > Number.MAX_SAFE_INTEGER)
        throw new ApiError('Invalid integer amount');
    return Number(v);
};
const safe = (v: any): any => v?.toMillis ? v.toMillis() : Array.isArray(v) ? v.map(safe) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, safe(x)])) : v;
const pick = (data: Data, fields: string[]) => Object.fromEntries(fields.filter(k => data[k] !== undefined).map(k => [k, safe(data[k])]));
const sources: Record<string, [
    string,
    string[]
]> = {
    codes: ['orinContracts', ['code', 'title', 'asset', 'direction', 'duration_sec', 'settlement_bps', 'eligibility', 'opens_at', 'closes_at', 'published_at', 'hash', 'admin_id']],
    users: ['users', ['uid', 'displayName', 'email', 'disabled', 'createdAt']], kyc: ['orinKycRequests', ['uid', 'status', 'createdAt', 'updatedAt', 'reviewedBy', 'reason', 'revision', 'documentIds']],
    wallets: ['orinBonusWallets', ['uid', 'accountId', 'bonusCents', 'profitCents', 'withdrawableProfitCents', 'claimed', 'expiresAt']], deposits: ['orinDeposits', ['uid', 'accountId', 'amountCents', 'coin', 'status', 'paymentId', 'credited', 'createdAt', 'updatedAt', 'reviewReason']], withdrawals: ['orinControlWithdrawals', ['uid', 'accountId', 'currency', 'cents', 'status', 'providerReference', 'createdAt', 'revision']], approvals: ['orinControlApprovals', ['kind', 'uid', 'accountId', 'deltaCents', 'status', 'reason', 'reference', 'requestedBy', 'approvedBy', 'beforeCents', 'afterCents', 'createdAt', 'revision']],
    trading: ['orinExecutedTrades', ['user_id', 'accountId', 'contract_id', 'status', 'amount_cents', 'result_cents', 'started_at', 'settled_at']], markets: ['orinControlMarkets', ['pair', 'name', 'category', 'enabled', 'order', 'source', 'revision']], bonus: ['orinBonusWallets', ['uid', 'accountId', 'bonusCents', 'profitCents', 'withdrawableProfitCents', 'claimed', 'expiresAt', 'termsVersion']], referrals: ['orinReferralRewards', ['referrerId', 'referredId', 'status', 'amountCents', 'createdAt', 'termsVersion', 'revision']], agencies: ['orinProgramMembers', ['uid', 'referralId', 'agencyId', 'agencyGranted', 'directCount', 'activeTeamCount', 'teamCount', 'activityRewardCents', 'revision']], badges: ['orinProgramMembers', ['uid', 'badges', 'referralId', 'revision']], notifications: ['orinControlNotifications', ['title', 'message', 'audience', 'targetUid', 'segment', 'status', 'startsAt', 'expiresAt', 'revision', 'delivered', 'createdAt']], content: ['orinControlContent', ['slug', 'titleAr', 'titleEn', 'bodyAr', 'bodyEn', 'status', 'revision', 'updatedAt']], security: ['orinControlSecurity', ['uid', 'event', 'status', 'createdAt', 'adminId']], staff: ['orinStaff', ['email', 'roles', 'status', 'validAfter', 'revision', 'createdAt']], audit: ['orinControlAudit', ['adminId', 'action', 'target', 'timestamp', 'reason', 'previous', 'next', 'requestId', 'referenceId']]
};
export async function controlSession(u: Identity) { const staff = await requirePermission(u, 'dashboard.read'), integration = (await controlRef('Integrations', 'current').get()).data() ?? {}; return { available: true, uid: u.id, roles: staff.roles, permissions: permissionsFor(staff.roles), reauthSeconds: 300, capabilities: { payments: integration.payments === true, execution: integration.execution === true, kycDocuments: !!process.env.ORIN_KYC_BUCKET, push: false, scheduler: integration.scheduler === true } }; }
async function requireModule(u: Identity, module: string, exporting = false) {
    const m = CONTROL_MODULES.find(x => x[0] === module);
    if (!m)
        throw new ApiError('Unknown module', 404);
    const staff = await requirePermission(u, m[3]);
    if (exporting)
        await requirePermission(u, 'reports.export');
    return staff;
}
export async function controlRead(u: Identity, module: string, q: Data = {}) {
    if (module === 'session')
        return controlSession(u);
    const staff = await requireModule(u, module, q.export === 'true');
    if (module === 'support-ai') return readSupportAdmin(u, q);
    if (module === 'tickets') return readTickets(u, q);
    if (module === 'audit') return readAudit(u, q);
    if (module === 'dashboard') {
        const stats: Data[] = [];
        for (const [id, collection, permission] of [['users', 'users', 'users.read'], ['kyc', 'orinKycRequests', 'kyc.read'], ['deposits', 'orinDeposits', 'finance.read'], ['withdrawals', 'orinControlWithdrawals', 'finance.read'], ['referrals', 'orinReferralRewards', 'programs.read'], ['bonus', 'orinBonusWallets', 'programs.read']] as const) {
            if (!permissionsFor(staff.roles).includes(permission))
                continue;
            try {
                stats.push({ id, count: (await db.collection(collection).count().get()).data().count });
            }
            catch {
                stats.push({ id, count: null });
            }
        }
        if (permissionsFor(staff.roles).includes('accounts.read'))
            for (const type of ['real', 'demo']) {
                try {
                    stats.push({ id: 'accounts_' + type, count: (await db.collectionGroup('accounts').where('type', '==', type).count().get()).data().count });
                }
                catch {
                    stats.push({ id: 'accounts_' + type, count: null });
                }
            }
        const activity = permissionsFor(staff.roles).includes('audit.read') ? (await controlRef('Audit', '_').parent.orderBy('timestamp', 'desc').limit(12).get()).docs.map(d => ({ id: d.id, ...d.data() })) : [];
        return { stats, activity, queues: await operationQueues(u, staff.roles), asOf: Date.now(), capabilities: (await controlSession(u)).capabilities };
    }
    if (module === 'configuration')
        return { rows: [{ id: 'current', ...CONTROL_DEFAULTS, ...(await controlRef('Configuration', 'current').get()).data() }], nextCursor: null };
    if (module === 'markets') {
        const [stored, current] = await Promise.all([db.collection('orinControlMarkets').get(), ref('sparkConfiguration', 'markets').get()]);
        const config = { ...DEFAULT_CONFIGURATION, ...current.data()?.configuration };
        const byPair = new Map(stored.docs.map(d => [d.id, d.data()]));
        const rows = MARKET_SYMBOLS.map((s, i) => ({ id: s.pair, pair: s.pair, name: s.name, category: s.category, source: s.tv, revision: 0, ...byPair.get(s.pair), enabled: config.enabledSymbols.includes(s.pair), order: config.enabledSymbols.indexOf(s.pair) >= 0 ? config.enabledSymbols.indexOf(s.pair) : i }));
        if (q.export === 'true')
            await db.runTransaction(async (tx) => { await requirePermission(u, 'reports.export', tx, true); controlAudit(tx, randomUUID(), u, 'report.export', 'markets', 'Administrative market export', null, { rows: rows.length }, randomUUID()); });
        return { rows, nextCursor: null };
    }
    if (module === 'team')
        return { rows: ((await ref('orinProgramConfiguration', 'current').get()).data()?.levels ?? TEAM_LEVELS).map((v: Data) => ({ id: 'L' + v.level, ...v })), configuration: { ...DEFAULT_PROGRAM_CONFIG, ...(await ref('orinProgramConfiguration', 'current').get()).data() }, nextCursor: null };
    if (module === 'users' && q.search) {
        const term = text(q.search, 320), found = new Map<string, Data>();
        const exact = await ref('users', /^[A-Za-z0-9_-]{1,128}$/.test(term) ? term : '__no_match__').get();
        if (exact.exists)
            found.set(exact.id, pick(exact.data()!, sources.users[1]));
        if (/^\d{12}$/.test(term)) {
            const n = (await ref('sparkAccountNumbers', term).get()).data();
            if (n) {
                const s = await ref('users', n.ownerId).get();
                if (s.exists)
                    found.set(s.id, pick(s.data()!, sources.users[1]));
            }
        }
        for (const field of ['email', 'displayName']) {
            const rows = await db.collection('users').where(field, '==', term).limit(30).get();
            rows.forEach(d => found.set(d.id, pick(d.data(), sources.users[1])));
        }
        const results: Data[] = [];
        for (const [id, d] of found) {
            const access = (await controlRef('Access', id).get()).data();
            results.push({ id, ...d, status: access?.status ?? (d.disabled ? 'suspended' : 'active'), revision: access?.revision ?? 0 });
        }
        if (q.export === 'true')
            await db.runTransaction(async (tx) => { await requirePermission(u, 'reports.export', tx, true); controlAudit(tx, randomUUID(), u, 'report.export', 'users', 'Administrative search export', null, { rows: results.length }, randomUUID()); });
        return { rows: results, nextCursor: null, searchMode: 'exact' };
    }
    let query: FirebaseFirestore.Query = ['accounts', 'wallets'].includes(module) ? db.collectionGroup('accounts') : db.collection(sources[module][0]);
    if (q.status && q.status !== 'all' && !['users', 'accounts', 'codes'].includes(module))
        query = query.where('status', '==', text(q.status, 30));
    query = query.orderBy(FieldPath.documentId());
    if (q.cursor) {
        if (['accounts', 'wallets'].includes(module)) {
            if (typeof q.cursor !== 'string' || !/^sparkTradingAccounts\/[-A-Za-z0-9_]+\/accounts\/[-A-Za-z0-9_]+$/.test(q.cursor))
                throw new ApiError('Invalid cursor');
            query = query.startAfter(db.doc(q.cursor));
        }
        else
            query = query.startAfter(key(q.cursor));
    }
    const page = await query.limit(51).get(), rows: Data[] = page.docs.slice(0, 50).filter(d => !['accounts', 'wallets'].includes(module) || d.ref.path.startsWith('sparkTradingAccounts/')).map(d => ({ id: d.id, ...(['accounts', 'wallets'].includes(module) ? pick(d.data(), ['ownerId', 'accountNumber', 'type', 'currency', 'balanceCents', 'reservedCents', 'realizedCents', 'createdAt']) : pick(d.data(), sources[module][1])) }));
    if (module === 'deposits') for (const row of rows) Object.assign(row,{cents:row.amountCents,currency:'USD',providerReference:row.paymentId??null,provider:'nowpayments'});
    if (module === 'codes') for (const row of rows) { const state = (await ref('orinControlContractStates', row.id).get()).data(); Object.assign(row, {mode:row.mode??'production',status:state?.status??'active',revision:state?.revision??0}); }
    if (module === 'users')
        for (const row of rows) {
            const access = (await controlRef('Access', row.id).get()).data();
            Object.assign(row, { status: access?.status ?? (row.disabled ? 'suspended' : 'active'), revision: access?.revision ?? 0 });
        }
    if (module === 'accounts' && !permissionsFor(staff.roles).includes('wallet.read'))
        for (const row of rows) {
            delete row.balanceCents;
            delete row.reservedCents;
            delete row.realizedCents;
        }
    if (module === 'accounts')
        for (const row of rows) {
            const access = (await controlRef('AccountStates', hash(row.ownerId + ':' + row.id)).get()).data();
            Object.assign(row, { status: access?.status ?? 'active', revision: access?.revision ?? 0 });
        }
    if (module === 'wallets')
        for (const row of rows) {
            const bonus = (await ref('orinBonusWallets', row.ownerId).get()).data(), b = bonus?.accountId === row.id ? bonus : null;
            row.uid = row.ownerId;
            row.accountId = row.id;
            row.cashCents = row.balanceCents;
            row.bonusCents = b?.bonusCents ?? 0;
            row.profitCents = b?.profitCents ?? 0;
            row.withdrawableProfitCents = b?.withdrawableProfitCents ?? 0;
            row.lockedProfitCents = row.profitCents - row.withdrawableProfitCents;
            row.withdrawableCashCents = null;
            row.withdrawalEligibility = 'provider_required';
        }
    if (q.export === 'true')
        await db.runTransaction(async (tx) => { await requirePermission(u, 'reports.export', tx, true); controlAudit(tx, randomUUID(), u, 'report.export', module, 'Administrative report export', null, { rows: rows.length, cursor: q.cursor ?? null }, randomUUID()); });
    return { rows, nextCursor: page.size > 50 ? (['accounts', 'wallets'].includes(module) ? page.docs[49].ref.path : page.docs[49].id) : null, asOf: Date.now() };
}
export async function controlUser(u: Identity, uid: string) {
    await requirePermission(u, 'users.read');
    key(uid);
    const s = await ref('users', uid).get();
    if (!s.exists)
        throw new ApiError('User not found', 404);
    const perms = permissionsFor((await ref('orinStaff', u.id).get()).data()?.roles);
    const [access, member] = await Promise.all([controlRef('Access', uid).get(), ref('orinProgramMembers', uid).get()]);
    const out: Data = { user: { id: uid, ...pick(s.data()!, sources.users[1]), ...pick(access.data() ?? {}, ['status', 'revision', 'reason']) } };
    if (perms.includes('accounts.read'))
        out.accounts = (await db.collection(`sparkTradingAccounts/${uid}/accounts`).limit(100).get()).docs.map(d => ({ id: d.id, ...pick(d.data(), ['accountNumber', 'type', 'currency', ...(perms.includes('wallet.read') ? ['balanceCents', 'reservedCents'] : [])]) }));
    if (perms.includes('kyc.read'))
        out.kyc = (await db.collection('orinKycRequests').where('uid', '==', uid).limit(20).get()).docs.map(d => ({ id: d.id, ...pick(d.data(), sources.kyc[1]) }));
    if (perms.includes('programs.read'))
        out.program = pick(member.data() ?? {}, sources.agencies[1].concat(['badges', 'code']));
    if (perms.includes('wallet.read'))
        out.bonus = pick((await ref('orinBonusWallets', uid).get()).data() ?? {}, sources.bonus[1]);
    return out;
}
function validateConfig(raw: Data) {
    if (Object.keys(raw).some(k => !Object.hasOwn(CONTROL_DEFAULTS, k)))
        throw new ApiError('Only public operational settings are allowed');
    const next = { ...CONTROL_DEFAULTS, ...raw };
    for (const k of ['maintenance', 'tradingEnabled', 'depositsEnabled', 'withdrawalsEnabled', 'referralsEnabled', 'bonusEnabled'] as const)
        if (typeof next[k] !== 'boolean')
            throw new ApiError('Invalid switch');
    integer(next.minimumVersionCode, 1);
    if (next.maxAdjustmentCents !== null)
        integer(next.maxAdjustmentCents, 1);
    for (const k of ['messageAr', 'messageEn'] as const)
        text(next[k], 300);
    if (next.supportEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next.supportEmail))
        throw new ApiError('Invalid support email');
    if (next.supportUrl && !/^https:\/\/[^\s<>]+$/.test(next.supportUrl))
        throw new ApiError('HTTPS support URL required');
    return next;
}
export async function controlAction(u: Identity, input: Data) {
    if (typeof input?.action === 'string' && (input.action.startsWith('support.ai.') || input.action.startsWith('support.knowledge.'))) return supportAdminAction(u,input);
    const action = String(input.action), permission = ACTION_PERMISSIONS[action as keyof typeof ACTION_PERMISSIONS];
    if (!permission)
        throw new ApiError('Unsupported control action');
    const requestId = key(input.requestId), reason = text(input.reason, 1000), target = key(input.target ?? u.id), fingerprint = hash(JSON.stringify(input)), command = controlRef('Commands', hash(u.id + ':' + requestId)), now = Date.now();
    let output: Data = { saved: true };
    const recent = ['user.', 'account.', 'contract.', 'reward.', 'finance.', 'payment.', 'staff.', 'security.', 'configuration.', 'program.', 'kyc.'].some(p => action.startsWith(p));
    await db.runTransaction(async (tx) => {
        const staff = await requirePermission(u, permission, tx, recent), used = await tx.get(command);
        if (used.exists) {
            if (used.data()!.fingerprint !== fingerprint)
                throw new ApiError('Request ID conflict', 409);
            output = used.data()!.result;
            return;
        }
        let before: any = null, after: any = null;
        const payload = input.data ?? {};
        if (!payload || typeof payload !== 'object' || Array.isArray(payload))
            throw new ApiError('Invalid payload');
        if (action.startsWith('contract.')) {
            const result = await applyContractAction(tx, u, action, target, payload, input.revision, now);
            before=result.before; after=result.after; output=result.output;
        }
        else if (action.startsWith('ticket.')) {
            const result = await applyTicketAction(tx, u, action, target, payload, input.revision, now, requestId);
            before = result.before; after = result.after; output = result.output;
        }
        else if (action === 'user.status') {
            if (target === u.id || !['active', 'restricted', 'suspended'].includes(payload.status))
                throw new ApiError('Invalid status change');
            const [p, s, a] = await Promise.all([tx.get(ref('users', target)), tx.get(ref('orinStaff', target)), tx.get(controlRef('Access', target))]);
            if (!p.exists || s.exists)
                throw new ApiError('Staff must be managed in Staff & roles', 403);
            before = a.data() ?? { status: p.data()!.disabled ? 'suspended' : 'active', revision: 0 };
            if (input.revision !== before.revision)
                throw new ApiError('Record changed; reload', 409);
            after = { status: payload.status, reason, revision: before.revision + 1, updatedAt: now };
            tx.set(controlRef('Access', target), after);
            tx.update(ref('users', target), { disabled: payload.status === 'suspended', updatedAt: FieldValue.serverTimestamp() });
        }
        else if (action === 'account.create') {
            const user = await tx.get(ref('users', target));
            if (!user.exists || user.data()!.disabled || !['real', 'demo'].includes(payload.type))
                throw new ApiError('Invalid owner/account type');
            const accountId = key(payload.accountId ?? requestId), a = db.doc(`sparkTradingAccounts/${target}/accounts/${accountId}`);
            if ((await tx.get(a)).exists)
                throw new ApiError('Account already exists', 409);
            let number = '';
            for (let i = 0; i < 5; i++) {
                number = String(BigInt(100000000000) + BigInt('0x' + randomBytes(6).toString('hex')) % BigInt(900000000000));
                if (!(await tx.get(ref('sparkAccountNumbers', number))).exists)
                    break;
                number = '';
            }
            if (!number)
                throw new ApiError('Account number allocation unavailable', 503);
            after = { id: accountId, ownerId: target, accountNumber: number, type: payload.type, currency: 'USD', balanceCents: 0, reservedCents: 0, realizedCents: 0, createdAt: FieldValue.serverTimestamp() };
            tx.create(a, after);
            tx.create(ref('sparkAccountNumbers', number), { ownerId: target, accountId, createdAt: FieldValue.serverTimestamp() });
            output = { saved: true, accountId, accountNumber: number };
            after = { ...after, createdAt: now };
        }
        else if (action === 'account.status') {
            const uid = key(payload.uid), a = await tx.get(db.doc(`sparkTradingAccounts/${uid}/accounts/${target}`));
            if (!a.exists || !['active', 'restricted'].includes(payload.status))
                throw new ApiError('Invalid account');
            const r = controlRef('AccountStates', hash(uid + ':' + target));
            before = (await tx.get(r)).data() ?? { status: 'active', revision: 0 };
            if (before.revision !== input.revision)
                throw new ApiError('Record changed', 409);
            after = { uid, accountId: target, status: payload.status, reason, revision: before.revision + 1 };
            tx.set(r, after);
        }
        else if (action === 'kyc.review') {
            const r = ref('orinKycRequests', target);
            before = (await tx.get(r)).data();
            if (!before || before.revision !== input.revision)
                throw new ApiError('KYC request changed', 409);
            const transitions: Record<string, string[]> = { pending: ['review'], review: ['verified', 'rejected', 'more_information'], more_information: ['review'], rejected: ['review'], verified: [] };
            if (payload.status === 'verified' && (!before.documentIds?.length || before.evidenceComplete !== true))
                throw new ApiError('Complete submitted evidence is required', 409);
            if (!transitions[before.status]?.includes(payload.status))
                throw new ApiError('Invalid KYC transition', 409);
            after = { ...before, status: payload.status, reason, reviewedBy: u.id, reviewedAt: now, revision: before.revision + 1 };
            tx.update(r, { status: after.status, reason, reviewedBy: u.id, reviewedAt: now, revision: after.revision });
            before = pick(before, ['uid', 'status', 'revision']);
            after = pick(after, ['uid', 'status', 'revision', 'reason', 'reviewedBy']);
        }
        else if (action === 'reward.propose') {
            const s = await rewardSnapshot(tx, payload), reference = text(payload.reference, 128), unique = controlRef('FinancialReferences', hash(reference));
            if ((await tx.get(unique)).exists)
                throw new ApiError('Financial reference already used', 409);
            after = { kind: 'reward', rewardKind: s.kind, rewardId: s.rewardId, rewardRevision: s.reward.revision ?? null, uid: s.uid, accountId: s.accountId, deltaCents: s.cents, beforeCents: s.account.balanceCents, afterCents: s.account.balanceCents + s.cents, status: 'pending', reason, reference, requestedBy: u.id, revision: 0, createdAt: now };
            tx.create(controlRef('Approvals', requestId), after);
            tx.create(unique, { approvalId: requestId });
            output = { saved: true, approvalId: requestId };
        }
        else if (action === 'finance.propose') {
            const cfg = (await tx.get(controlRef('Configuration', 'current'))).data();
            if (!cfg?.maxAdjustmentCents || cfg.maintenance)
                throw new ApiError('Approve a finance limit before adjustments', 409);
            const uid = key(payload.uid), accountId = key(payload.accountId), delta = Number(payload.deltaCents);
            if (!Number.isSafeInteger(delta) || !delta || Math.abs(delta) > cfg.maxAdjustmentCents)
                throw new ApiError('Adjustment outside approved limit');
            await controlAccess({ id: uid } as Identity, true, tx);
            await controlAccount(uid, accountId, tx);
            const a = (await tx.get(db.doc(`sparkTradingAccounts/${uid}/accounts/${accountId}`))).data();
            if (!a || a.ownerId !== uid || a.type !== 'real' || a.currency !== 'USD')
                throw new ApiError('Real USD account required');
            integer(a.balanceCents + delta, Math.max(0, a.reservedCents ?? 0));
            const reference = text(payload.reference, 128), unique = controlRef('FinancialReferences', hash(reference));
            if ((await tx.get(unique)).exists)
                throw new ApiError('Financial reference already used', 409);
            after = { kind: 'adjustment', uid, accountId, deltaCents: delta, beforeCents: a.balanceCents, afterCents: a.balanceCents + delta, status: 'pending', reason, reference, requestedBy: u.id, revision: 0, createdAt: now };
            tx.create(controlRef('Approvals', requestId), after);
            tx.create(unique, { approvalId: requestId });
            output = { saved: true, approvalId: requestId };
        }
        else if (action === 'finance.approve' || action === 'finance.reject') {
            const r = controlRef('Approvals', target);
            before = (await tx.get(r)).data();
            if (!before || before.status !== 'pending' || before.requestedBy === u.id || before.revision !== input.revision)
                throw new ApiError('Requires a different reviewer and a pending unchanged request', 409);
            const maker = (await tx.get(ref('orinStaff', before.requestedBy))).data();
            const makerProfile = (await tx.get(ref('users', before.requestedBy))).data();
            if (makerProfile?.disabled || maker?.validAfter > before.createdAt || maker?.status !== 'active' || !permissionsFor(maker.roles).includes('finance.propose'))
                throw new ApiError('Requester no longer authorized', 403);
            after = { ...before, status: action === 'finance.reject' ? 'rejected' : 'approved', approvedBy: u.id, reviewReason: reason, reviewedAt: now, revision: before.revision + 1 };
            if (action === 'finance.approve') {
                const cfg = (await tx.get(controlRef('Configuration', 'current'))).data();
                if (cfg?.maintenance)
                    throw new ApiError('Maintenance', 503);
                await controlAccess({ id: before.uid } as Identity, true, tx);
                await controlAccount(before.uid, before.accountId, tx);
                if (before.kind === 'adjustment') {
                    if (!cfg?.maxAdjustmentCents || Math.abs(before.deltaCents) > cfg.maxAdjustmentCents)
                        throw new ApiError('Adjustment policy changed', 409);
                    const a = db.doc(`sparkTradingAccounts/${before.uid}/accounts/${before.accountId}`), data = (await tx.get(a)).data();
                    if (!data || data.type !== 'real' || data.ownerId !== before.uid || data.balanceCents !== before.beforeCents || data.currency !== 'USD')
                        throw new ApiError('Balance changed; submit a new request', 409);
                    integer(data.balanceCents + before.deltaCents, Math.max(0, data.reservedCents ?? 0));
                    tx.update(a, { balanceCents: data.balanceCents + before.deltaCents });
                    tx.create(ref('orinProgramLedger', 'control-' + target), { uid: before.uid, accountId: before.accountId, kind: 'adjustment', entries: [{ account: 'cash', cents: before.deltaCents }, { account: 'adjustment-clearing', cents: -before.deltaCents }], createdAt: now, reference: before.reference, requestedBy: before.requestedBy, approvedBy: u.id });
                    after.status = 'completed';
                }
                else if (before.kind === 'reward') {
                    await settleReward(tx, before, target, u.id, now);
                    after.status = 'completed';
                }
                else if (before.kind === 'payment') {
                    const p = controlRef(before.module === 'deposits' ? 'Deposits' : 'Withdrawals', before.paymentId), payment = (await tx.get(p)).data(), integration = (await tx.get(controlRef('Integrations', 'current'))).data();
                    if (!payment || payment.status !== 'pending' || payment.revision !== before.paymentRevision)
                        throw new ApiError('Payment changed', 409);
                    if (!integration?.payments)
                        throw new ApiError('Payment adapter is not connected', 409);
                    // Approval queues an immutable instruction. Only a verified provider callback can complete it.
                    tx.create(controlRef('PaymentOutbox', target), { paymentId: before.paymentId, module: before.module, decision: before.decision, uid: before.uid, accountId: before.accountId, status: 'queued', requestedBy: before.requestedBy, approvedBy: u.id, createdAt: now });
                    tx.update(p, { status: 'processing', revision: payment.revision + 1, approvalId: target });
                }
                else
                    throw new ApiError('Unknown financial operation');
            }
            tx.update(r, after);
        }
        else if (action === 'payment.review') {
            if (!['deposits', 'withdrawals'].includes(payload.module) || !['approve', 'reject', 'cancel'].includes(payload.decision))
                throw new ApiError('Invalid payment decision');
            const r = controlRef(payload.module === 'deposits' ? 'Deposits' : 'Withdrawals', target);
            const p = (await tx.get(r)).data();
            if (!p || p.status !== 'pending' || p.revision !== input.revision)
                throw new ApiError('Only pending payments can be reviewed', 409);
            after = { kind: 'payment', paymentId: target, module: payload.module, decision: payload.decision, uid: p.uid, accountId: p.accountId, paymentRevision: p.revision, status: 'pending', requestedBy: u.id, reason, revision: 0, createdAt: now };
            tx.create(controlRef('Approvals', requestId), after);
            output = { saved: true, approvalId: requestId };
        }
        else if (action === 'staff.set' || action === 'staff.invite') {
            if (!Array.isArray(payload.roles) || !payload.roles.length || !permissionsFor(payload.roles).length || payload.roles.some((x: string) => !Object.hasOwn(ROLES, x)))
                throw new ApiError('Invalid role');
            if (payload.roles.length !== 1)
                throw new ApiError('Assign one role; combine only through a reviewed role definition');
            const gate = await tx.get(ref('system', 'control-center'));
            if (!gate.exists)
                throw new ApiError('Bootstrap required', 409);
            if (action === 'staff.invite') {
                const email = text(payload.email, 320).toLowerCase();
                if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || payload.roles.includes('super_admin'))
                    throw new ApiError('Invite a non-super role; promote a verified existing staff member separately');
                after = { email, roles: payload.roles, status: 'pending', createdBy: u.id, createdAt: now, expiresAt: now + 7 * 86400000 };
                tx.set(controlRef('Invitations', hash(email)), after);
            }
            else {
                if (target === u.id)
                    throw new ApiError('Cannot change your own role or status', 403);
                if (!['active', 'disabled'].includes(payload.status))
                    throw new ApiError('Invalid staff status');
                const [profile, old] = await Promise.all([tx.get(ref('users', target)), tx.get(ref('orinStaff', target))]);
                if (!profile.exists)
                    throw new ApiError('Existing registered user required');
                before = old.data() ?? { revision: 0, status: 'disabled', roles: [] };
                if ((before.revision ?? 0) !== input.revision)
                    throw new ApiError('Staff record changed', 409);
                const was = before.status === 'active' && before.roles.includes('super_admin'), will = payload.status === 'active' && payload.roles.includes('super_admin'), count = gate.data()!.superAdminCount + (will ? 1 : 0) - (was ? 1 : 0);
                if (count < 1)
                    throw new ApiError('Cannot remove the last Super Admin', 409);
                after = { email: profile.data()!.email, roles: payload.roles, status: payload.status, revision: (before.revision ?? 0) + 1, validAfter: now, updatedBy: u.id, updatedAt: now };
                tx.set(ref('orinStaff', target), after);
                tx.update(gate.ref, { superAdminCount: count });
            }
        }
        else if (action === 'configuration.save') {
            const r = controlRef('Configuration', 'current');
            before = (await tx.get(r)).data() ?? { revision: 0 };
            if (input.revision !== before.revision)
                throw new ApiError('Configuration changed', 409);
            const c = validateConfig(payload), integration = (await tx.get(controlRef('Integrations', 'current'))).data() ?? {};
            if (c.tradingEnabled && !integration.execution || (c.depositsEnabled || c.withdrawalsEnabled) && !integration.payments)
                throw new ApiError('Connect the trusted provider before enabling execution or payments', 409);
            after = { ...c, revision: before.revision + 1, updatedAt: now };
            tx.create(controlRef('ConfigurationHistory', String(after.revision)), { ...after, adminId: u.id, reason });
            tx.set(r, after);
            const { maxAdjustmentCents, ...publicConfig } = after;
            tx.set(ref('orinPublicConfiguration', 'current'), publicConfig);
        }
        else if (action === 'content.save' || action === 'notification.save') {
            const notification = action.startsWith('notification'), r = controlRef(notification ? 'Notifications' : 'Content', target);
            before = (await tx.get(r)).data() ?? { revision: 0 };
            if (input.revision !== before.revision)
                throw new ApiError('Draft changed', 409);
            if (notification) {
                if (!['all', 'user', 'segment'].includes(payload.audience) || !['all', 'real', 'demo', 'agents', 'verified'].includes(payload.segment ?? 'all'))
                    throw new ApiError('Invalid audience');
                after = { title: text(payload.title, 80), message: text(payload.message, 500), audience: payload.audience, targetUid: payload.audience === 'user' ? key(payload.targetUid) : null, segment: payload.segment ?? 'all', startsAt: integer(payload.startsAt), expiresAt: integer(payload.expiresAt) };
                if (after.expiresAt <= Math.max(now, after.startsAt))
                    throw new ApiError('Invalid delivery period');
            }
            else
                after = { slug: target, titleAr: text(payload.titleAr, 100), titleEn: text(payload.titleEn, 100), bodyAr: text(payload.bodyAr, 20000), bodyEn: text(payload.bodyEn, 20000) };
            after = { ...after, status: 'draft', revision: before.revision + 1, updatedAt: now, updatedBy: u.id };
            tx.set(r, after);
        }
        else if (action === 'content.publish' || action === 'notification.publish') {
            const notification = action.startsWith('notification'), r = controlRef(notification ? 'Notifications' : 'Content', target);
            before = (await tx.get(r)).data();
            if (!before || before.status !== 'draft' || before.revision !== input.revision || payload.previewRevision !== before.revision)
                throw new ApiError('Preview the current draft before publishing', 409);
            after = { ...before, status: notification ? (before.startsAt > now ? 'scheduled' : 'queued') : 'published', revision: before.revision + 1, publishedAt: now, publishedBy: u.id };
            if (notification) {
                const integration = (await tx.get(controlRef('Integrations', 'current'))).data();
                if (!integration?.scheduler)
                    throw new ApiError('Notification delivery worker is not activated', 409);
                tx.create(controlRef('NotificationOutbox', target + '_' + after.revision), { ...after, campaignId: target, status: after.status });
            }
            else {
                tx.set(ref('orinPublicContent', target), after);
                tx.create(controlRef('ContentHistory', target + '_' + after.revision), after);
            }
            tx.update(r, after);
        }
        else if (action === 'market.save') {
            const pair = String(payload.pair), symbol = MARKET_SYMBOLS.find(s => s.pair === pair);
            if (!symbol || typeof payload.enabled !== 'boolean')
                throw new ApiError('A connected supported symbol is required');
            integer(payload.order);
            if (target !== pair)
                throw new ApiError('Use the canonical market identifier');
            const r = controlRef('Markets', pair);
            before = (await tx.get(r)).data() ?? { revision: 0 };
            if (input.revision !== before.revision)
                throw new ApiError('Market changed', 409);
            const previous = (await tx.get(ref('sparkConfiguration', 'markets'))).data(), config = { ...DEFAULT_CONFIGURATION, ...previous?.configuration };
            const enabled = config.enabledSymbols.filter((s: string) => s !== pair);
            if (payload.enabled)
                enabled.splice(Math.min(payload.order, enabled.length), 0, pair);
            if (!enabled.length)
                throw new ApiError('At least one market must remain enabled');
            after = { pair, name: symbol.name, category: symbol.category, source: symbol.tv, enabled: payload.enabled, order: payload.order, revision: before.revision + 1 };
            tx.set(r, after);
            const configuration = { ...config, enabledSymbols: enabled, defaultSymbol: enabled.includes(config.defaultSymbol) ? config.defaultSymbol : enabled[0] };
            tx.set(ref('sparkConfiguration', 'markets'), { configuration, revision: (previous?.revision ?? 0) + 1, updatedAt: FieldValue.serverTimestamp() });
            tx.set(ref('orinConfiguration', 'markets'), { configuration, revision: (previous?.revision ?? 0) + 1, updated_at: now });
        }
        else if (action === 'agency.set' || action === 'badge.grant') {
            const r = ref('orinProgramMembers', target);
            before = (await tx.get(r)).data();
            if (!before)
                throw new ApiError('Program member required', 404);
            if ((before.revision ?? 0) !== input.revision)
                throw new ApiError('Member changed', 409);
            if (action === 'agency.set') {
                if (typeof payload.granted !== 'boolean')
                    throw new ApiError('Invalid agency state');
                after = { agencyGranted: payload.granted, agencyId: before.agencyId ?? 'AG-' + randomBytes(6).toString('hex').toUpperCase(), agencyReason: reason, agencyGrantedBy: u.id, revision: (before.revision ?? 0) + 1 };
            }
            else {
                const badge = BADGES.find(b => b.id === payload.badge);
                if (!badge || ['verified', 'first_deposit', 'trader'].includes(badge.id))
                    throw new ApiError('This badge requires trusted automatic evidence', 409);
                const evidence = text(payload.evidenceReference, 128);
                after = { badges: [...new Set([...(before.badges ?? []), badge.id])], badgeReview: { adminId: u.id, reason, evidenceReference: evidence, at: now }, revision: (before.revision ?? 0) + 1 };
            }
            tx.update(r, after);
            before = pick(before, ['agencyGranted', 'agencyId', 'badges', 'revision']);
        }
        else if (action === 'referral.review') {
            const r = ref('orinReferralRewards', target);
            before = (await tx.get(r)).data();
            if (!before || (before.revision ?? 0) !== input.revision)
                throw new ApiError('Referral changed', 409);
            const transition: Record<string, string[]> = { pending: ['qualified', 'rejected'], qualified: ['approved', 'rejected'], approved: ['rejected'] };
            if (!transition[before.status]?.includes(payload.status))
                throw new ApiError('Invalid referral transition; payouts use the financial queue', 409);
            if (payload.status !== 'rejected') {
                const [a, b, e] = await Promise.all([tx.get(ref('orinVerifiedCustomers', before.referrerId)), tx.get(ref('orinVerifiedCustomers', before.referredId)), tx.get(ref('orinProgramEvidence', key(payload.evidenceId)))]);
                if (before.referrerId === before.referredId || !a.data()?.verified || !b.data()?.verified || a.data()?.revoked || b.data()?.revoked || a.data()?.customerKey === b.data()?.customerKey || e.data()?.uid !== before.referredId || e.data()?.kind !== 'referral_qualified' || e.data()?.revoked || e.data()?.termsVersion !== before.termsVersion)
                    throw new ApiError('Trusted evidence for distinct qualified customers required', 409);
            }
            const parent = ref('orinProgramMembers', before.referrerId), parentData = (await tx.get(parent)).data();
            if (!parentData)
                throw new ApiError('Referrer unavailable', 409);
            after = { status: payload.status, reason, reviewedBy: u.id, reviewedAt: now, evidenceId: payload.evidenceId ?? before.evidenceId ?? null, revision: (before.revision ?? 0) + 1 };
            tx.update(r, after);
            tx.update(ref('orinProgramMembers', before.referredId), { referralStatus: payload.status });
            if (before.status === 'pending' && payload.status === 'qualified')
                tx.update(parent, { qualifiedCount: (parentData.qualifiedCount ?? 0) + 1, pendingCents: (parentData.pendingCents ?? 0) + before.amountCents });
            if (['qualified', 'approved'].includes(before.status) && payload.status === 'rejected')
                tx.update(parent, { qualifiedCount: Math.max(0, (parentData.qualifiedCount ?? 0) - 1), pendingCents: Math.max(0, (parentData.pendingCents ?? 0) - before.amountCents) });
        }
        else if (action === 'security.revoke') {
            if (target === u.id)
                throw new ApiError('Use sign out for your own session');
            const p = await tx.get(ref('users', target));
            if (!p.exists)
                throw new ApiError('User not found', 404);
            const isStaff = await tx.get(ref('orinStaff', target));
            if (isStaff.exists && !staff.roles.includes('super_admin'))
                throw new ApiError('Only Super Admin may revoke a staff session', 403);
            // Revoke session-bound Firestore grants in the same transaction, even
            // if the later identity-provider revocation call is temporarily down.
            const accountSecurity = await tx.get(ref('orinAccountSecurity', target));
            after = { uid: target, validAfter: now, revision: input.revision ?? 0 };
            tx.set(controlRef('SessionRevocations', target), after);
            tx.set(accountSecurity.ref, { epoch: (accountSecurity.data()?.epoch ?? 0) + 1 }, { merge: true });
            if (isStaff.exists)
                tx.update(isStaff.ref, { validAfter: now });
            tx.create(controlRef('Security', requestId), { uid: target, event: 'sessions_revoked', status: 'revoked_at_api', adminId: u.id, createdAt: now });
        }
        else if (action === 'program.configure')
            throw new ApiError('Use versioned program configuration endpoint', 409);
        else
            throw new ApiError('Action unavailable', 409);
        controlAudit(tx, 'command-' + command.id, u, action, target, reason, before, after, requestId);
        tx.create(command, { fingerprint, result: output, createdAt: now });
    });
    if (action === 'security.revoke') {
        try {
            await auth.revokeRefreshTokens(target);
        }
        catch {
            output = { ...output, authRevocationPending: true };
        }
    }
    return output;
}
export async function acceptStaffInvitation(u: Identity) {
    if (!u.verified)
        throw new ApiError('Verified email required', 403);
    await db.runTransaction(async (tx) => {
        const r = controlRef('Invitations', hash(u.email.toLowerCase())), invite = (await tx.get(r)).data(), staff = await tx.get(ref('orinStaff', u.id));
        if (!invite || invite.status !== 'pending' || invite.expiresAt < Date.now() || staff.exists || invite.roles.includes('super_admin'))
            throw new ApiError('No valid staff invitation', 403);
        const creator = (await tx.get(ref('orinStaff', invite.createdBy))).data();
        if (creator?.status !== 'active' || !creator.roles.includes('super_admin'))
            throw new ApiError('Invitation issuer no longer authorized', 403);
        tx.create(ref('orinStaff', u.id), { email: u.email, roles: invite.roles, status: 'active', revision: 0, createdAt: Date.now() });
        tx.update(r, { status: 'accepted', uid: u.id });
        controlAudit(tx, randomUUID(), u, 'staff.accept', u.id, 'Verified staff invitation accepted', null, { roles: invite.roles }, randomUUID());
    });
    return controlSession(u);
}
