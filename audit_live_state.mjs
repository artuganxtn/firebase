import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';

const envContent = fs.readFileSync('.env', 'utf-8');
const match = envContent.match(/FIREBASE_SERVICE_ACCOUNT=(.*)/);
const sa = JSON.parse(match[1]);
const app = initializeApp({ credential: cert(sa) });
const auth = getAuth(app);
const db = getFirestore(app);

async function run() {
  console.log('=== [1] FIREBASE AUTH USERS ===');
  const userList = await auth.listUsers(10);
  console.log(`Found ${userList.users.length} users:`);
  for (const u of userList.users.slice(0, 5)) {
    console.log(`  UID: ${u.uid} | Email: ${u.email} | Verified: ${u.emailVerified}`);
  }

  console.log('\n=== [2] FIRESTORE /users DOCS ===');
  const usersSnap = await db.collection('users').limit(5).get();
  console.log(`Found ${usersSnap.size} user docs:`);
  for (const doc of usersSnap.docs) {
    console.log(`  ${doc.id} =>`, doc.data());
  }

  console.log('\n=== [3] FIRESTORE /sparkProfiles DOCS ===');
  const profilesSnap = await db.collection('sparkProfiles').limit(5).get();
  console.log(`Found ${profilesSnap.size} profile docs:`);

  console.log('\n=== [4] FIRESTORE /orinSecuritySessions ===');
  const sessionsSnap = await db.collection('orinSecuritySessions').limit(5).get();
  console.log(`Found ${sessionsSnap.size} active sessions:`);
  for (const doc of sessionsSnap.docs) {
    const d = doc.data();
    console.log(`  Session ${doc.id} => uid: ${d.uid}, status: ${d.status}, expiresAtMs: ${d.expiresAtMs}`);
  }

  console.log('\n=== [5] SYSTEM MARKET CONFIGURATION ===');
  const marketDoc = await db.collection('sparkConfiguration').doc('markets').get();
  console.log(`sparkConfiguration/markets exists: ${marketDoc.exists}`);
  if (marketDoc.exists) {
    console.log(`  defaultSymbol:`, marketDoc.data()?.configuration?.defaultSymbol);
  }

  console.log('\n=== [6] AUDIT COMPLETE ===');
}

run().catch(console.error);
