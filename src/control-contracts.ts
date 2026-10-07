import type { Transaction } from 'firebase-admin/firestore';
import { ASSETS } from '../../lib/contracts';
import { ref, hash, ApiError, type Identity, type Data } from './store';

/** Codes refer to the existing virtual contract engine. Never execute real orders. */
export async function applyContractAction(tx: Transaction, u: Identity, action: string, target: string, payload: Data, revision: unknown, now: number) {
    const r = ref('orinContracts', target), stateRef = ref('orinControlContractStates', target);
    const [existing, status] = await Promise.all([tx.get(r), tx.get(stateRef)]);
    if (action === 'contract.revoke') {
        if (!existing.exists) throw new ApiError('Contract not found', 404);
        const before = status.data() ?? { status: 'active', revision: 0 };
        if (before.revision !== revision || before.status !== 'active') throw new ApiError('Contract changed', 409);
        const after = { status: 'revoked', revision: before.revision + 1, updatedAt: now, updatedBy: u.id };
        tx.set(stateRef, after);
        return { before, after, output: { saved: true, contractId: target } };
    }
    if (existing.exists || revision !== 0) throw new ApiError('Contract already exists', 409);
    const { asset, direction, durationSec, settlementBps, opensAt, closesAt } = payload;
    const title = typeof payload.title === 'string' ? payload.title.trim() : '', eligibility = payload.eligibility ?? 'all';
    const mode = payload.mode ?? 'production';
    if ((mode !== 'production' && mode !== 'virtual-test-only') || !title || title.length > 80 || !Object.hasOwn(ASSETS, asset) || !['BUY', 'SELL'].includes(direction)) throw new ApiError('Valid contract terms are required');
    if (!Number.isSafeInteger(durationSec) || durationSec < 60 || durationSec > 300 || !Number.isSafeInteger(settlementBps) || Math.abs(settlementBps) > 1000) throw new ApiError('Duration 60–300 seconds; settlement −10% to +10%');
    if (!['all', 'standard', 'advanced'].includes(eligibility) || !Number.isSafeInteger(opensAt) || !Number.isSafeInteger(closesAt) || opensAt < now - 60000 || closesAt <= Math.max(now, opensAt) || closesAt - opensAt > 30 * 86400000) throw new ApiError('Invalid participation window');
    const code = `LAB-${hash(target).slice(0, 10).toUpperCase()}`;
    if ((await tx.get(ref('orinCodes', code))).exists) throw new ApiError('Code collision; use a new request', 409);
    const terms = { version: 1, mode, id: target, code, title, asset, direction, durationSec, settlementBps, eligibility, opensAt, closesAt, publishedAt: now, adminId: u.id };
    const canonical = JSON.stringify(terms), digest = hash(canonical);
    const after = { id: target, code, title, asset, direction, duration_sec: durationSec, settlement_bps: settlementBps, eligibility, opens_at: opensAt, closes_at: closesAt, published_at: now, admin_id: u.id, canonical, hash: digest, participants: 0 };
    tx.create(r, after);
    tx.create(ref('orinCodes', code), { contractId: target });
    tx.create(stateRef, { status: 'active', revision: 0, updatedAt: now, updatedBy: u.id });
    return { before: null, after, output: { saved: true, contractId: target, code, hash: digest } };
}
