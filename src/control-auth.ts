import { db, ref, hash, ApiError, type Identity, type Data } from './store';
import type { Transaction } from 'firebase-admin/firestore';
import { permissionsFor, type Permission } from '../../lib/control-center';
export const controlRef = (kind: string, id: string) => ref('orinControl' + kind, id);
export async function requirePermission(u: Identity, permission: Permission, tx?: Transaction, recent = false) {
    const read = (r: FirebaseFirestore.DocumentReference) => tx ? tx.get(r) : r.get();
    const [p, s, gate, revocation] = await Promise.all([read(ref('users', u.id)), read(ref('orinStaff', u.id)), read(controlRef('Access', u.id)), read(controlRef('SessionRevocations', u.id))]);
    if (!u.verified || !p.exists || p.data()!.disabled || p.data()!.email !== u.email || gate.data()?.status === 'suspended' || !s.exists || s.data()!.status !== 'active' || s.data()!.email !== u.email || !permissionsFor(s.data()!.roles).includes(permission))
        throw new ApiError('لا تملك الصلاحية المطلوبة. / Permission denied.', 403);
    if (revocation.exists && (!u.authTime || u.authTime * 1000 <= revocation.data()!.validAfter))
        throw new ApiError('Admin session revoked', 401);
    if (s.data()!.validAfter && (!u.authTime || u.authTime * 1000 <= s.data()!.validAfter))
        throw new ApiError('انتهت جلسة الإدارة. أعد تسجيل الدخول. / Admin session revoked.', 401);
    if (recent && (!u.authTime || Date.now() / 1000 - u.authTime > 300 || u.authTime > Date.now() / 1000 + 60))
        throw new ApiError('أعد المصادقة قبل هذه العملية. / Recent authentication required.', 401);
    return s.data()!;
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
