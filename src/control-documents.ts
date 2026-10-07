import { getStorage } from 'firebase-admin/storage';
import { randomUUID } from 'node:crypto';
import { app, db, ref, ApiError, type Identity } from './store';
import { requirePermission, controlAudit } from './control-auth';
export async function controlDocument(u: Identity, requestId: string, documentId: string, res: any) {
    await requirePermission(u, 'kyc.documents', undefined, true);
    if (!/^[-A-Za-z0-9_]{1,128}$/.test(requestId) || !/^[-A-Za-z0-9_]{1,128}$/.test(documentId))
        throw new ApiError('Invalid document');
    const request = (await ref('orinKycRequests', requestId).get()).data(), doc = (await ref('orinKycDocuments', documentId).get()).data();
    if (!request || !doc || doc.requestId !== requestId || doc.uid !== request.uid || !request.documentIds?.includes(documentId) || doc.path !== `kyc/${doc.uid}/${requestId}/${documentId}`)
        throw new ApiError('Document unavailable', 404);
    if (!process.env.ORIN_KYC_BUCKET)
        throw new ApiError('Private document storage is not connected', 503);
    const bucket = getStorage(app).bucket(process.env.ORIN_KYC_BUCKET), [policy] = await bucket.getMetadata();
    if (policy.iamConfiguration?.publicAccessPrevention !== 'enforced' || !policy.iamConfiguration?.uniformBucketLevelAccess?.enabled)
        throw new ApiError('Private bucket access policy is not enforced', 409);
    const file = bucket.file(doc.path, { generation: doc.generation }), [metadata] = await file.getMetadata();
    if (Number(metadata.size) > 8 * 1024 * 1024 || !['application/pdf', 'image/jpeg', 'image/png'].includes(metadata.contentType ?? '') || metadata.metadata?.firebaseStorageDownloadTokens)
        throw new ApiError('Document storage policy requires review', 409);
    await db.runTransaction(async (tx) => { await requirePermission(u, 'kyc.documents', tx, true); controlAudit(tx, randomUUID(), u, 'kyc.document.read', requestId, 'Authorized private document review', null, { documentId }, randomUUID()); });
    res.set('Cache-Control', 'private, no-store');
    res.set('Content-Security-Policy', "sandbox; default-src 'none'");
    res.set('Content-Type', metadata.contentType);
    res.set('Content-Disposition', 'attachment; filename="ORIN-KYC-document.' + (metadata.contentType === 'application/pdf' ? 'pdf' : metadata.contentType === 'image/png' ? 'png' : 'jpg') + '"');
    await new Promise<void>((resolve, reject) => { const stream = file.createReadStream(); stream.on('error', reject); res.on('finish', resolve); res.on('close', () => { stream.destroy(); resolve(); }); stream.pipe(res); });
}
