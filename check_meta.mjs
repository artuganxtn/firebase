import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import process from 'node:process';

process.loadEnvFile();

const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
const app = getApps()[0] ?? initializeApp({ credential: cert(sa) });
const auth = getAuth(app);

async function listMeta() {
  const users = await auth.listUsers();
  for (const u of users.users) {
    console.log(`Email: ${u.email}, Created: ${u.metadata.creationTime}, LastSignIn: ${u.metadata.lastSignInTime}`);
  }
}

listMeta().catch(console.error);
