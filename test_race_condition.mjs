import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, doc, runTransaction, serverTimestamp } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyAGi8Ky9SrzrQEzJdIgXSe8G36J_OarSQA',
  authDomain: 'orin-99951.firebaseapp.com',
  projectId: 'orin-99951',
  storageBucket: 'orin-99951.firebasestorage.app',
  messagingSenderId: '484189355938',
  appId: '1:484189355938:web:b0fae35afd11598519bcfb'
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const apiKey = firebaseConfig.apiKey;

async function testRace() {
  const email = `test_race_${Date.now()}@example.com`;
  const pwd = 'TestPassword123!';
  
  // 1. Create user
  const regRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: pwd, returnSecureToken: true })
  });
  const regData = await regRes.json();
  const uid = regData.localId;
  console.log("Registered:", uid);

  // 2. Sign in with Email and Password using Client SDK
  const cred = await signInWithEmailAndPassword(auth, email, pwd);
  console.log("Signed in with email/password. Token auth_time:", (await cred.user.getIdTokenResult()).claims.auth_time);

  // 3. Request security session from Render
  const token = await cred.user.getIdToken(true);
  const renderRes = await fetch('https://firebase-functions-pc5h.onrender.com/orinSecurity/api/security/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + token
    },
    body: JSON.stringify({ device: { platform: 'Android', appVersion: '1.6.2' } })
  });
  const bundle = await renderRes.json();
  console.log("Render returned bundle with customToken?", !!bundle.customToken);

  // 4. Exchange token
  await signInWithCustomToken(auth, bundle.customToken);
  console.log("signInWithCustomToken resolved");

  // 5. Try Firestore transaction IMMEDIATELY with the old `cred.user`
  const ref = doc(db, 'users', uid);
  try {
    await runTransaction(db, async tx => {
      const snap = await tx.get(ref);
      console.log("snap exists:", snap.exists());
      if (!snap.exists()) {
        tx.set(ref, {
          uid,
          email,
          displayName: 'Race Test',
          role: 'user',
          disabled: false,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
    });
    console.log("Transaction SUCCESS!");
  } catch (err) {
    console.error("Transaction FAILED:", err.code, err.message);
  }
}

testRace().catch(console.error);
