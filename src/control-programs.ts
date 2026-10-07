import { db, ref, ApiError, type Identity, type Data } from './store';
import { requirePermission } from './control-auth';
import { adminPrograms, validConfig } from './programs';
export async function controlProgramConfiguration(u: Identity, input: Data) {
    await requirePermission(u, 'programs.configure', undefined, true);
    if (typeof input.reason !== 'string' || input.reason.trim().length < 3 || input.reason.length > 1000)
        throw new ApiError('Review reason required');
    const c = validConfig(input.data);
    return adminPrograms(u, { action: 'configure', configuration: c, revision: input.revision, requestId: input.requestId, reason: input.reason });
}
