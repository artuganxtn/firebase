import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { getFirestore, doc, runTransaction, serverTimestamp, getDoc, updateDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyAGi8Ky9SrzrQEzJdIgXSe8G36J_OarSQA",
  authDomain: "orin-99951.firebaseapp.com",
  projectId: "orin-99951",
  storageBucket: "orin-99951.firebasestorage.app",
  messagingSenderId: "1011939119830",
  appId: "1:1011939119830:web:86e0887df924eefb74efb9"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

async function ensureAccountProfile(db, user) {
  const ref = doc(db, 'users', user.uid);
  const snapshot = await runTransaction(db, async transaction => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists()) {
      transaction.set(ref, {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || 'مستخدم ORIN',
        role: 'user',
        disabled: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    }
    return snapshot;
  });
  if (user.emailVerified && snapshot.data()?.role !== 'admin') {
    try {
      await getDoc(doc(db, 'system', 'owner-bootstrap'));
      await updateDoc(ref, { role: 'admin', updatedAt: serverTimestamp() });
    } catch(e) {
      if (e.code !== 'permission-denied') throw e;
    }
  }
}

async function testSignupAndProfile() {
  const email = `test_flow_${Date.now()}@example.com`;
  const pwd = 'TestPassword123!';
  console.log('1. Creating user:', email);
  const cred = await createUserWithEmailAndPassword(auth, email, pwd);
  console.log('Created user UID:', cred.user.uid);

  console.log('2. Updating profile displayName...');
  await updateProfile(cred.user, { displayName: 'Test User' });

  console.log('3. Calling ensureAccountProfile...');
  try {
    await ensureAccountProfile(db, cred.user);
    console.log('ensureAccountProfile SUCCEEDED!');
    const docSnap = await getDoc(doc(db, 'users', cred.user.uid));
    console.log('users doc exists:', docSnap.exists(), docSnap.data());
  } catch (e) {
    console.error('ensureAccountProfile FAILED:', e.code, e.message);
  }
}

testSignupAndProfile().catch(console.error);
