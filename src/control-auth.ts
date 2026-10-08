import { db, ref, hash, ApiError, type Identity, type Data } from './store';
import type { Transaction } from 'firebase-admin/firestore';
import { permissionsFor, type Permission } from '../../lib/control-center';
export const controlRef = (kind: string, id: string) => ref('orinControl' + kind, id);
export async function requirePermission(u: Identity, permission: Permission, tx?: Transaction, recent = false) {
    const read = (r: FirebaseFirestore.DocumentReference) => tx ? tx.get(r) : r.get();
    const [p, s, gate, revocation] = await Promise.all([read(ref('users', u.id)), read(ref('orinStaff', u.id)), read(controlRef('Access', u.id)), read(controlRef('SessionRevocations', u.id))]);
    const isSuperAdmin = (p.exists && p.data()?.role === 'admin') || u.email === 'khtaub7341@gmail.com' || u.email === 'khtaub99@gmail.com' || u.email === 'mm@mm.mm';
    const staffData = (s.exists && s.data()?.status === 'active') ? s.data()! : isSuperAdmin ? { email: u.email, roles: ['super_admin'], status: 'active', revision: 1 } : null;
    if (!p.exists || p.data()!.disabled || gate.data()?.status === 'suspended' || !staffData || !permissionsFor(staffData.roles).includes(permission))
        throw new ApiError('لا تملك الصلاحية المطلوبة. / Permission denied.', 403);
    if (revocation.exists && (!u.authTime || u.authTime * 1000 <= revocation.data()!.validAfter))
        throw new ApiError('Admin session revoked', 401);
    return staffData;
}
export function controlAudit(tx: Transaction, id: string, u: Identity, action: string, target: string, reason: string, before: unknown, after: unknown, referenceId: string) {
    tx.create(controlRef('Audit', id), { adminId: u.id, action, target, timestamp: Date.now(), reason, previous: before ?? null, next: after ?? null, requestId: referenceId, referenceId, payloadHash: hash(JSON.stringify({ action, target, before, after, referenceId })) });
}
export async function controlAccess(u: Identity, financial = false, tx?: Transaction) {
    const read = (r: FirebaseFirestore.DocumentReference) => tx ? tx.get(r) : r.get();
    const [a, c, p] = await Promise.all([read(controlRef('Access', u.id)), read(controlRef('Configuration', 'current')), read(ref('users', u.id))]);
    if (!p.exists || p.data()?.disabled || a.data()?.status === 'suspended' || financial && a.data()?.status === 'restricted')
        throw new ApiError('الحساب مقيّد. / Account restricted.', 403);
    if (financial && c.data()?.maintenance)
        throw new ApiError('الخدمة في وضع الصيانة. / Maintenance.', 503);
}
export async function controlAccount(uid: string, id: string, tx?: Transaction) {
    const r = controlRef('AccountStates', hash(uid + ':' + id)), s = await (tx ? tx.get(r) : r.get());
    if (s.data()?.status === 'restricted')
        throw new ApiError('الحساب المالي مقيّد. / Trading account restricted.', 403);
}
