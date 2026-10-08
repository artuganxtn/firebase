import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';

const envContent = fs.readFileSync('.env', 'utf-8');
const match = envContent.match(/FIREBASE_SERVICE_ACCOUNT=(.*)/);
const sa = JSON.parse(match[1]);
const adminApp = initializeApp({ credential: cert(sa) });
const auth = getAuth(adminApp);
const db = getFirestore(adminApp);

async function testUserSparkApi() {
  const list = await auth.listUsers(50);
  const sorted = list.users.sort((a, b) => new Date(b.metadata.creationTime) - new Date(a.metadata.creationTime));
  const latest = sorted[0];
  console.log('Latest user:', latest.uid, latest.email, latest.metadata.creationTime);

  const userDoc = await db.collection('users').doc(latest.uid).get();
  console.log('users/{uid} exists:', userDoc.exists, userDoc.data());

  const profileDoc = await db.collection('sparkProfiles').doc(latest.uid).get();
  console.log('sparkProfiles/{uid} exists:', profileDoc.exists, profileDoc.data());

  const configDoc = await db.collection('sparkConfiguration').doc('markets').get();
  console.log('sparkConfiguration/markets exists:', configDoc.exists);

  const labDoc = await db.collection('sparkLabStates').doc(latest.uid).get();
  console.log('sparkLabStates/{uid} exists:', labDoc.exists);
}

testUserSparkApi().catch(console.error);
