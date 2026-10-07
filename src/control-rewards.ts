import { db, ref, ApiError, type Data, type Identity } from './store';
import type { Transaction } from 'firebase-admin/firestore';
import { controlAccess, controlAccount } from './control-auth';
const key = (v: unknown) => {
    if (typeof v !== 'string' || !/^[-A-Za-z0-9_]{1,128}$/.test(v))
        throw new ApiError('Invalid reward identifier');
    return v;
};
export async function rewardSnapshot(tx: Transaction, p: Data) {
    const kind = p.rewardKind;
    if (!['referral', 'team'].includes(kind))
        throw new ApiError('Invalid reward kind');
    const rewardId = key(p.rewardId), rewardRef = ref(kind === 'referral' ? 'orinReferralRewards' : 'orinEligibleRevenue', rewardId), reward = (await tx.get(rewardRef)).data();
    if (!reward)
        throw new ApiError('Reward evidence unavailable', 409);
    const config = (await tx.get(ref('orinProgramConfiguration', 'current'))).data();
    if (!config?.enabled)
        throw new ApiError('Reward program is not active', 409);
    let cents: number, uid: string;
    if (kind === 'referral') {
        if (reward.status !== 'approved' || !reward.evidenceId)
            throw new ApiError('Approved referral and trusted evidence required', 409);
        uid = key(reward.referrerId);
        const [a, b, e] = await Promise.all([tx.get(ref('orinVerifiedCustomers', uid)), tx.get(ref('orinVerifiedCustomers', key(reward.referredId))), tx.get(ref('orinProgramEvidence', key(reward.evidenceId)))]);
        if (uid === reward.referredId || !a.data()?.verified || !b.data()?.verified || a.data()?.revoked || b.data()?.revoked || a.data()?.customerKey === b.data()?.customerKey || e.data()?.revoked || e.data()?.uid !== reward.referredId || e.data()?.kind !== 'referral_qualified' || e.data()?.termsVersion !== reward.termsVersion)
            throw new ApiError('Referral evidence no longer valid', 409);
        cents = reward.amountCents;
    }
    else {
        uid = key(reward.uid);
        if (!reward.finalized || reward.paidAt || !Number.isSafeInteger(reward.netRevenueCents) || reward.netRevenueCents <= 0 || !Number.isInteger(reward.direct) || !Number.isInteger(reward.activeTeam) || !Number.isInteger(reward.configurationRevision))
            throw new ApiError('Finalized versioned net revenue required', 409);
        const version = (await tx.get(ref('orinProgramConfigurationHistory', String(reward.configurationRevision)))).data();
        if (!version || version.termsVersion !== reward.termsVersion)
            throw new ApiError('Historical program version is required', 409);
        const level = [...version.levels].reverse().find(l => reward.direct >= l.direct && reward.activeTeam >= l.active);
        if (!level)
            throw new ApiError('No qualified team level', 409);
        cents = Math.min(level.capCents, Number(BigInt(reward.netRevenueCents) * BigInt(level.bps) / BigInt(10000)));
    }
    if (!Number.isSafeInteger(cents) || cents <= 0 || cents > 1e12)
        throw new ApiError('Invalid reward amount');
    const accountId = key(p.accountId), accountRef = db.doc(`sparkTradingAccounts/${uid}/accounts/${accountId}`), account = (await tx.get(accountRef)).data(), memberRef = ref('orinProgramMembers', uid), member = (await tx.get(memberRef)).data();
    await controlAccess({ id: uid } as Identity, true, tx);
    await controlAccount(uid, accountId, tx);
    if (!member || !account || account.ownerId !== uid || account.type !== 'real' || account.currency !== 'USD' || !Number.isSafeInteger(account.balanceCents + cents))
        throw new ApiError('Eligible real USD wallet required', 409);
    return { kind, uid, cents, accountId, accountRef, account, memberRef, member, rewardRef, reward, rewardId };
}
export async function settleReward(tx: Transaction, before: Data, approvalId: string, approver: string, now: number) {
    const s = await rewardSnapshot(tx, before);
    if (s.cents !== before.deltaCents || s.uid !== before.uid || s.account.balanceCents !== before.beforeCents || (s.reward.revision ?? null) !== before.rewardRevision)
        throw new ApiError('Reward or balance changed; propose again', 409);
    // All checks and reads precede the first write in the transaction.
    tx.update(s.accountRef, { balanceCents: s.account.balanceCents + s.cents });
    if (s.kind === 'referral') {
        if ((s.member.pendingCents ?? 0) < s.cents)
            throw new ApiError('Reward aggregate requires reconciliation', 409);
        tx.update(s.rewardRef, { status: 'paid', paidAt: now, accountId: s.accountId, approvalId, revision: (s.reward.revision ?? 0) + 1 });
        tx.update(ref('orinProgramMembers', s.reward.referredId), { referralStatus: 'paid' });
        tx.update(s.memberRef, { pendingCents: s.member.pendingCents - s.cents, paidCents: (s.member.paidCents ?? 0) + s.cents });
    }
    else {
        tx.update(s.rewardRef, { paidAt: now, approvalId });
        tx.create(ref('orinActivityPayments', s.rewardId), { uid: s.uid, cents: s.cents, configurationRevision: s.reward.configurationRevision, netRevenueCents: s.reward.netRevenueCents, createdAt: now, approvalId });
        tx.update(s.memberRef, { activityRewardCents: (s.member.activityRewardCents ?? 0) + s.cents });
    }
    tx.create(ref('orinProgramLedger', 'control-' + approvalId), { uid: s.uid, accountId: s.accountId, kind: s.kind === 'referral' ? 'referral_reward' : 'team_activity', entries: [{ account: 'cash', cents: s.cents }, { account: 'program-expense', cents: -s.cents }], createdAt: now, requestedBy: before.requestedBy, approvedBy: approver, reference: before.reference, rewardId: s.rewardId });
}
