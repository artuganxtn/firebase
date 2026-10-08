import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, runTransaction, serverTimestamp, getDoc } from 'firebase/firestore';
import { firebaseConfig } from '../firebase-web/config.js';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

async function testClientWrite() {
  // Try with bnb@bb.bb
  try {
    const cred = await signInWithEmailAndPassword(auth, 'bnb@bb.bb', 'TestPassword123!');
    console.log('Signed in as bnb@bb.bb, uid:', cred.user.uid);
    const ref = doc(db, 'users', cred.user.uid);
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      console.log('snap exists:', snap.exists());
      if (!snap.exists()) {
        tx.set(ref, {
          uid: cred.user.uid,
          email: cred.user.email,
          displayName: cred.user.displayName || 'مستخدم ORIN',
          role: 'user',
          disabled: false,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
    });
    console.log('SUCCESS TRANSACTION!');
  } catch (e) {
    console.error('TRANSACTION ERROR:', e.code, e.message);
  }
}

testClientWrite().catch(console.error);
