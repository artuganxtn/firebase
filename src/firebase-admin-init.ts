import {initializeApp, getApps, cert, type App} from 'firebase-admin/app';
import {getFirestore, type Firestore} from 'firebase-admin/firestore';
import {getAuth, type Auth} from 'firebase-admin/auth';

export function getAdminApp(): App {
  if (getApps().length > 0) return getApps()[0];
  const sa = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (sa) {
    try {
      const creds = typeof sa === 'string' ? JSON.parse(sa) : sa;
      return initializeApp({
        credential: cert(creds),
        projectId: creds.project_id || 'orin-99951'
      });
    } catch (e) {
      console.warn('Could not parse FIREBASE_SERVICE_ACCOUNT JSON:', e);
    }
  }
  return initializeApp({ projectId: 'orin-99951' });
}

export const adminApp: App = getAdminApp();
export const adminDb: Firestore = getFirestore(adminApp);
export const adminAuth: Auth = getAuth(adminApp);
