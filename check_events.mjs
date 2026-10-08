import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import process from 'node:process';

process.loadEnvFile();

const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
const app = getApps()[0] ?? initializeApp({ credential: cert(sa) });
const db = getFirestore(app);

async function checkClaims() {
  const snap = await db.collection('orinSecurityPrimaryClaims').get();
  console.log(`[orinSecurityPrimaryClaims] (${snap.size} docs):`);
  for (const doc of snap.docs) {
    console.log(doc.id, "=>", doc.data());
  }

  const events = await db.collection('orinSecurityEvents').get();
  console.log(`\n[orinSecurityEvents] (${events.size} docs):`);
  for (const doc of events.docs) {
    console.log(doc.id, "=>", doc.data());
  }
}

checkClaims().catch(console.error);
