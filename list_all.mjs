import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import process from 'node:process';

process.loadEnvFile();

const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
const app = getApps()[0] ?? initializeApp({ credential: cert(sa) });
const auth = getAuth(app);

async function listAll() {
  const users = await auth.listUsers(1000);
  for (const u of users.users) {
    console.log(`UID: ${u.uid}, Email: ${u.email}, Created: ${u.metadata.creationTime}, LastSignIn: ${u.metadata.lastSignInTime}, Provider: ${u.providerData.map(p=>p.providerId).join(',')}`);
  }
}

listAll().catch(console.error);
