import { FieldPath, type Transaction } from 'firebase-admin/firestore';
import { randomUUID } from 'node:crypto';
import { db, ref, hash, ApiError, type Data, type Identity } from './store';
import { controlRef, requirePermission, controlAudit } from './control-auth';
import { permissionsFor } from '../../lib/control-center';
import { TICKET_STATUSES, TICKET_PRIORITIES, TICKET_CATEGORIES, TICKET_TRANSITIONS, ACTIVE_TICKET_STATUSES } from '../../lib/control-workflow';

const identifier = (v: unknown) => {
    if (typeof v !== 'string' || !/^[-A-Za-z0-9_]{1,128}$/.test(v)) throw new ApiError('Invalid identifier');
    return v;
};
const bounded = (v: unknown, max: number) => {
    if (typeof v !== 'string' || !v.trim() || v.length > max) throw new ApiError('Required text is invalid');
    return v.trim();
};
const enumValue = (v: unknown, values: object) => {
    if (typeof v !== 'string' || !Object.hasOwn(values, v)) throw new ApiError('Invalid workflow value');
    return v;
};
const dueDate = (v: unknown) => {
    if (v === null || v === '') return null;
    if (!Number.isSafeInteger(v) || Number(v) < 0 || Number(v) > 8640000000000000) throw new ApiError('Invalid due date');
    return Number(v);
};
const only = (data: Data, fields: string[]) => {
    if (Object.keys(data).some(k => !fields.includes(k))) throw new ApiError('Unsupported ticket field');
};
const summary = (d: Data | undefined) => d ? Object.fromEntries(['uid', 'status', 'priority', 'category', 'assigneeId', 'dueAt', 'revision', 'noteCount'].map(k => [k, d[k] ?? null])) : null;
const ticketFields = ['uid', 'title', 'description', 'status', 'priority', 'category', 'assigneeId', 'dueAt', 'createdAt', 'updatedAt', 'createdBy', 'updatedBy', 'resolvedAt', 'closedAt', 'revision', 'noteCount'];
const project = (d: Data, fields: string[]) => Object.fromEntries(fields.filter(k => d[k] !== undefined).map(k => [k, d[k]]));

/** Cursors are bound to a module, filters and ordering; no raw document path is accepted. */
function applyCursor(query: FirebaseFirestore.Query, raw: unknown, scope: string) {
    if (!raw) return query;
    try {
        if (typeof raw !== 'string' || raw.length > 1000 || !/^[\w-]+$/.test(raw)) throw new Error();
        const c = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'));
        if (c.scope !== scope || !Number.isSafeInteger(c.at) || c.at < 0) throw new Error();
        return query.startAfter(c.at, identifier(c.id));
    } catch { throw new ApiError('Invalid or mismatched page cursor'); }
}
function pageResult(page: FirebaseFirestore.QuerySnapshot, timeField: string, scope: string, fields: string[]) {
    const docs = page.docs.slice(0, 50), last = docs.at(-1);
    return {
        rows: docs.map(d => ({ id: d.id, ...project(d.data(), fields) })),
        nextCursor: page.size > 50 && last ? Buffer.from(JSON.stringify({ scope, at: last.data()[timeField], id: last.id })).toString('base64url') : null,
        asOf: Date.now()
    };
}
async function recordExport(u: Identity, module: string, result: { rows: Data[] }, filters: Data) {
    await db.runTransaction(async tx => {
        await requirePermission(u, module === 'tickets' ? 'tickets.read' : 'audit.read', tx);
        await requirePermission(u, 'reports.export', tx, true);
        const requestId = randomUUID();
        controlAudit(tx, requestId, u, 'report.export', module, 'Filtered administrative page export', null, { rows: result.rows.length, filters }, requestId);
    });
}
export async function readTickets(u: Identity, q: Data) {
    await requirePermission(u, 'tickets.read');
    if (q.ticket) {
        if (q.export === 'true') throw new ApiError('Export the ticket list instead');
        const id = identifier(q.ticket), ticket = await controlRef('Tickets', id).get();
        if (!ticket.exists) throw new ApiError('Ticket not found', 404);
        const scope = hash('ticket-notes:' + id);
        const query = controlRef('Tickets', id).collection('notes').orderBy('createdAt', 'desc').orderBy(FieldPath.documentId(), 'desc');
        const page = pageResult(await applyCursor(query, q.notesCursor, scope).limit(51).get(), 'createdAt', scope, ['body', 'authorId', 'createdAt']);
        return { ticket: { id, ...project(ticket.data()!, ticketFields) }, notes: page.rows, nextNotesCursor: page.nextCursor };
    }
    let query: FirebaseFirestore.Query = db.collection('orinControlTickets');
    const filters: Data = {};
    if (q.status && q.status !== 'all') filters.status = q.status === 'active' ? 'active' : enumValue(q.status, TICKET_STATUSES);
    if (q.priority && q.priority !== 'all') filters.priority = enumValue(q.priority, TICKET_PRIORITIES);
    if (q.assignee && q.assignee !== 'all') {
        if (!['mine', 'unassigned'].includes(q.assignee)) throw new ApiError('Invalid assignee filter');
        filters.assigneeId = q.assignee === 'mine' ? u.id : '';
    }
    for (const [k, v] of Object.entries(filters)) query = k === 'status' && v === 'active' ? query.where(k, 'in', ACTIVE_TICKET_STATUSES) : query.where(k, '==', v);
    const scope = hash(JSON.stringify(['tickets', filters]));
    query = query.orderBy('updatedAt', 'desc').orderBy(FieldPath.documentId(), 'desc');
    const result = pageResult(await applyCursor(query, q.cursor, scope).limit(51).get(), 'updatedAt', scope, ticketFields.filter(k => k !== 'description'));
    if (q.export === 'true') await recordExport(u, 'tickets', result, filters);
    return result;
}
export async function readAudit(u: Identity, q: Data) {
    await requirePermission(u, 'audit.read');
    let query: FirebaseFirestore.Query = db.collection('orinControlAudit');
    const filters: Data = {};
    for (const field of ['adminId', 'action', 'target']) if (q[field]) {
        const value = bounded(q[field], field === 'action' ? 100 : 128);
        if (!/^[-A-Za-z0-9_.:]+$/.test(value)) throw new ApiError('Invalid audit filter');
        filters[field] = value; query = query.where(field, '==', value);
    }
    for (const [name, op] of [['from', '>='], ['to', '<=']] as const) if (q[name] !== undefined && q[name] !== '') {
        if (typeof q[name] !== 'string' || !/^\d{1,16}$/.test(q[name])) throw new ApiError('Invalid date boundary');
        const value = Number(q[name]);
        if (!Number.isSafeInteger(value) || value > 8640000000000000) throw new ApiError('Invalid date boundary');
        filters[name] = value; query = query.where('timestamp', op, value);
    }
    if (filters.from !== undefined && filters.to !== undefined && filters.from > filters.to) throw new ApiError('Start date must not follow end date');
    const scope = hash(JSON.stringify(['audit', filters]));
    query = query.orderBy('timestamp', 'desc').orderBy(FieldPath.documentId(), 'desc');
    const result = pageResult(await applyCursor(query, q.cursor, scope).limit(51).get(), 'timestamp', scope, ['adminId', 'action', 'target', 'timestamp', 'reason', 'previous', 'next', 'requestId', 'referenceId']);
    if (q.export === 'true') await recordExport(u, 'audit', result, filters);
    return result;
}
export async function operationQueues(u: Identity, roles: unknown) {
    const permissions = permissionsFor(roles), queues: Data[] = [];
    const definitions = [
        ['kyc', 'طلبات هوية تنتظر المراجعة', 'orinKycRequests', 'kyc.read', ['pending', 'review', 'more_information']],
        ['approvals', 'موافقات مالية معلّقة', 'orinControlApprovals', 'finance.read', ['pending']],
        ['withdrawals', 'سحوبات تنتظر المراجعة', 'orinControlWithdrawals', 'finance.read', ['pending']],
        ['tickets', 'تذاكر دعم مفتوحة', 'orinControlTickets', 'tickets.read', ACTIVE_TICKET_STATUSES]
    ] as const;
    for (const [module, label, collection, permission, states] of definitions) {
        if (!permissions.includes(permission)) continue;
        const count = async (query: FirebaseFirestore.Query) => { try { return (await query.count().get()).data().count; } catch { return null; } };
        const query = db.collection(collection).where('status', 'in', [...states]);
        queues.push({ id: module, module, label, count: await count(query) });
        if (module === 'tickets') {
            queues.push({ id: 'tickets_mine', module, label: 'تذاكري المفتوحة', assignee: 'mine', count: await count(query.where('assigneeId', '==', u.id)) });
            queues.push({ id: 'tickets_overdue', module, label: 'تذاكر متأخرة عن الموعد', count: await count(query.where('dueAt', '>', 0).where('dueAt', '<', Date.now())) });
        }
    }
    return queues;
}
export async function applyTicketAction(tx: Transaction, u: Identity, action: string, target: string, payload: Data, revision: unknown, now: number, requestId: string) {
    const staff = await requirePermission(u, 'tickets.manage', tx), canAssign = permissionsFor(staff.roles).includes('tickets.assign');
    const ticketRef = controlRef('Tickets', target), snapshot = await tx.get(ticketRef), before = snapshot.data();
    if (!Number.isSafeInteger(revision) || revision !== (before?.revision ?? 0)) throw new ApiError('Ticket changed; reload before saving', 409);
    let after: Data;
    if (action === 'ticket.create') {
        only(payload, ['uid', 'title', 'description', 'category', 'priority', 'dueAt']);
        if (before) throw new ApiError('Ticket already exists', 409);
        const uid = identifier(payload.uid);
        if (!(await tx.get(ref('users', uid))).exists) throw new ApiError('User not found', 404);
        after = { uid, title: bounded(payload.title, 160), description: bounded(payload.description, 4000), category: enumValue(payload.category, TICKET_CATEGORIES), priority: enumValue(payload.priority, TICKET_PRIORITIES), dueAt: dueDate(payload.dueAt ?? null), status: 'open', assigneeId: '', revision: 1, noteCount: 0, createdBy: u.id, updatedBy: u.id, createdAt: now, updatedAt: now, resolvedAt: null, closedAt: null };
        tx.create(ticketRef, after);
    } else {
        if (!before) throw new ApiError('Ticket not found', 404);
        if (action === 'ticket.note') {
            only(payload, ['body']);
            const body = bounded(payload.body, 4000);
            after = { ...before, revision: before.revision + 1, noteCount: before.noteCount + 1, updatedAt: now, updatedBy: u.id };
            tx.create(ticketRef.collection('notes').doc(requestId), { body, authorId: u.id, createdAt: now });
        } else if (action === 'ticket.update') {
            only(payload, ['status', 'priority', 'assigneeId', 'dueAt']);
            if (!canAssign && before.assigneeId && before.assigneeId !== u.id) throw new ApiError('Only the assigned agent or a supervisor may update this ticket', 403);
            const status = enumValue(payload.status, TICKET_STATUSES), priority = enumValue(payload.priority, TICKET_PRIORITIES);
            if (status !== before.status && !TICKET_TRANSITIONS[before.status]?.includes(status)) throw new ApiError('Invalid ticket status transition', 409);
            const assigneeId = payload.assigneeId === '' ? '' : identifier(payload.assigneeId);
            if (assigneeId !== before.assigneeId) {
                if (!canAssign && !((assigneeId === u.id && !before.assigneeId) || (!assigneeId && before.assigneeId === u.id))) throw new ApiError('Assignment permission required', 403);
            }
            if (assigneeId) {
                const [assignee, profile, gate] = await Promise.all([tx.get(ref('orinStaff', assigneeId)), tx.get(ref('users', assigneeId)), tx.get(controlRef('Access', assigneeId))]);
                if (assignee.data()?.status !== 'active' || !profile.exists || profile.data()?.disabled || gate.data()?.status === 'suspended' || assignee.data()?.email !== profile.data()?.email || !permissionsFor(assignee.data()?.roles).includes('tickets.manage')) throw new ApiError('Assignee must be active support staff', 409);
            }
            after = { ...before, status, priority, assigneeId, dueAt: dueDate(payload.dueAt ?? null), revision: before.revision + 1, updatedAt: now, updatedBy: u.id, resolvedAt: status === 'resolved' ? before.resolvedAt ?? now : status === 'closed' ? before.resolvedAt : null, closedAt: status === 'closed' ? before.closedAt ?? now : null };
        } else throw new ApiError('Unsupported ticket action');
        tx.set(ticketRef, after);
    }
    return { before: summary(before), after: { ...summary(after), ...(action === 'ticket.note' ? { noteId: requestId } : {}) }, output: { saved: true, ticketId: target, revision: after.revision } };
}
