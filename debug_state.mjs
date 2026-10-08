import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import process from 'node:process';

process.loadEnvFile();

const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
const app = getApps()[0] ?? initializeApp({ credential: cert(sa) });
const db = getFirestore(app);
const auth = getAuth(app);

async function main() {
  console.log("=== CHECKING FIRESTORE STATE ===");
  const usersAuth = await auth.listUsers();
  console.log(`\n[Firebase Auth Users] (${usersAuth.users.length}):`);
  for (const u of usersAuth.users) {
    console.log(`UID: ${u.uid}, Email: ${u.email}, DisplayName: ${u.displayName}`);
  }

  const usersSnap = await db.collection('users').get();
  console.log(`\n[Firestore /users] (${usersSnap.size} docs):`);
  for (const doc of usersSnap.docs) {
    console.log(`Doc ${doc.id} =>`, doc.data());
  }

  const sessionsSnap = await db.collection('orinSecuritySessions').get();
  console.log(`\n[Firestore /orinSecuritySessions] (${sessionsSnap.size} docs):`);
  for (const doc of sessionsSnap.docs) {
    const d = doc.data();
    console.log(`Session ${doc.id} => uid: ${d.uid}, status: ${d.status}, epoch: ${d.epoch}, expires: ${d.expiresAtMs}`);
  }

  const secSnap = await db.collection('orinAccountSecurity').get();
  console.log(`\n[Firestore /orinAccountSecurity] (${secSnap.size} docs):`);
  for (const doc of secSnap.docs) {
    console.log(`AccountSecurity ${doc.id} =>`, doc.data());
  }

  const marker = await db.collection('system').doc('account-security').get();
  console.log(`\n[System Marker]:`, marker.data());
}

main().catch(console.error);
