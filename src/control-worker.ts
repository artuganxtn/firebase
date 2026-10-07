/** Server-only in-app delivery. Provider Push is not claimed as delivered. */
import { randomUUID } from 'node:crypto';
import { db, ref, hash, FieldValue } from './store';
import { permissionsFor } from '../../lib/control-center';
export async function deliverControlNotifications(now = Date.now()) {
    if (!(await ref('orinControlIntegrations', 'current').get()).data()?.scheduler)
        return { enabled: false };
    const jobs = await db.collection('orinControlNotificationOutbox').where('status', 'in', ['queued', 'scheduled', 'delivering']).limit(10).get();
    for (const job of jobs.docs) {
        const lease = randomUUID();
        const d = await db.runTransaction(async (tx) => {
            const s = (await tx.get(job.ref)).data()!;
            if (!['queued', 'scheduled', 'delivering'].includes(s.status) || s.startsAt > now || s.leaseUntil > now)
                return null;
            const [staff, profile, campaign] = await Promise.all([tx.get(ref('orinStaff', s.publishedBy)), tx.get(ref('users', s.publishedBy)), tx.get(ref('orinControlNotifications', s.campaignId))]);
            if (s.expiresAt <= now || profile.data()?.disabled || staff.data()?.status !== 'active' || !permissionsFor(staff.data()?.roles).includes('notifications.manage') || staff.data()?.validAfter > s.publishedAt || campaign.data()?.revision !== s.revision) {
                tx.update(job.ref, { status: 'cancelled' });
                return null;
            }
            tx.update(job.ref, { status: 'delivering', lease, leaseUntil: now + 120000 });
            return s;
        });
        if (!d)
            continue;
        let query: FirebaseFirestore.Query = db.collection('users').orderBy('__name__');
        if (d.cursor)
            query = query.startAfter(d.cursor);
        const users = d.audience === 'user' ? [await ref('users', d.targetUid).get()] : (await query.limit(50).get()).docs;
        for (const user of users) {
            if (!user.exists)
                continue;
            await db.runTransaction(async (tx) => {
                const pointer = db.doc(`sparkProfiles/${user.id}/inbox/${job.id}`);
                const [staff, profile, recipient, access, latest, campaign, old] = await Promise.all([tx.get(ref('orinStaff', d.publishedBy)), tx.get(ref('users', d.publishedBy)), tx.get(user.ref), tx.get(ref('orinControlAccess', user.id)), tx.get(job.ref), tx.get(ref('orinControlNotifications', d.campaignId)), tx.get(pointer)]);
                if (old.exists || latest.data()?.lease !== lease || latest.data()?.leaseUntil < Date.now() || campaign.data()?.revision !== d.revision || recipient.data()?.disabled || access.data()?.status === 'suspended' || profile.data()?.disabled || staff.data()?.status !== 'active' || staff.data()?.validAfter > d.publishedAt || !permissionsFor(staff.data()?.roles).includes('notifications.manage'))
                    return;
                if (d.audience === 'segment') {
                    let eligible = true;
                    if (d.segment === 'agents')
                        eligible = (await tx.get(ref('orinProgramMembers', user.id))).data()?.agencyGranted === true;
                    else if (d.segment === 'verified') {
                        const verified = (await tx.get(ref('orinVerifiedCustomers', user.id))).data();
                        eligible = verified?.verified === true && !verified?.revoked;
                    }
                    else if (['real', 'demo'].includes(d.segment))
                        eligible = !(await tx.get(db.collection(`sparkTradingAccounts/${user.id}/accounts`).where('type', '==', d.segment).limit(1))).empty;
                    if (!eligible)
                        return;
                }
                tx.set(ref('sparkAnnouncements', job.id), { id: job.id, title: d.title, message: d.message, image: '', deep_link: '/notifications', expires_at: d.expiresAt, createdAt: FieldValue.serverTimestamp() });
                tx.create(pointer, { readAt: null, archivedAt: null, createdAt: FieldValue.serverTimestamp() });
                tx.create(ref('orinControlNotificationDelivery', hash(job.id + ':' + user.id)), { jobId: job.id, campaignId: d.campaignId, uid: user.id, status: 'in_app_delivered', createdAt: now });
            });
        }
        const delivered = (await db.collection('orinControlNotificationDelivery').where('jobId', '==', job.id).count().get()).data().count, more = d.audience !== 'user' && users.length === 50;
        await db.runTransaction(async (tx) => {
            const [latest, campaign] = await Promise.all([tx.get(job.ref), tx.get(ref('orinControlNotifications', d.campaignId))]);
            if (latest.data()?.lease !== lease)
                return;
            tx.update(job.ref, { status: more ? 'delivering' : 'completed', cursor: users.at(-1)?.id ?? null, delivered, leaseUntil: 0 });
            if (campaign.data()?.revision === d.revision)
                tx.update(campaign.ref, { status: more ? 'delivering' : 'completed', delivered, lastDeliveryAt: now });
        });
    }
    return { enabled: true, checked: jobs.size };
}
