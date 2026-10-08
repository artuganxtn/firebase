import { initializeApp } from 'firebase/app';
import { getAuth, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc, serverTimestamp, runTransaction } from 'firebase/firestore';

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

// Use the custom token returned by Render from our previous test!
// Or generate fresh one
const apiKey = firebaseConfig.apiKey;

async function testRules() {
  console.log("=== 1. Register test user ===");
  const email = `test_firestore_${Date.now()}@example.com`;
  const regRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'TestPassword123!', returnSecureToken: true })
  });
  const regData = await regRes.json();
  const uid = regData.localId;
  const initialIdToken = regData.idToken;
  console.log("Registered UID:", uid, "Email:", email);

  console.log("\n=== 2. Call Render Login to get custom token with sid ===");
  const loginRes = await fetch('https://firebase-functions-pc5h.onrender.com/orinSecurity/api/security/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + initialIdToken
    },
    body: JSON.stringify({ device: { platform: 'Android', appVersion: '1.6.2' } })
  });
  const bundle = await loginRes.json();
  console.log("Render returned customToken?", !!bundle.customToken, "sessionId:", bundle.sessionId);

  console.log("\n=== 3. signInWithCustomToken in Firebase Client SDK ===");
  const userCredential = await signInWithCustomToken(auth, bundle.customToken);
  const user = userCredential.user;
  const idTokenResult = await user.getIdTokenResult();
  console.log("Claims on token:", idTokenResult.claims);

  console.log("\n=== 4. Test Firestore transaction on users/{uid} ===");
  const userDocRef = doc(db, 'users', uid);
  try {
    const snap = await runTransaction(db, async (tx) => {
      const s = await tx.get(userDocRef);
      console.log("Doc exists before set?", s.exists());
      if (!s.exists()) {
        tx.set(userDocRef, {
          uid: uid,
          email: user.email,
          displayName: 'Test User',
          role: 'user',
          disabled: false,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
      return s;
    });
    console.log("Transaction SUCCESS! User created in Firestore.");
  } catch (err) {
    console.error("Transaction FAILED with error:", err.code, err.message);
  }
}

testRules().catch(console.error);
