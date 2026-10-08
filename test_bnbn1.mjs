import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import process from 'node:process';

process.loadEnvFile();

const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
const app = getApps()[0] ?? initializeApp({ credential: cert(sa) });
const auth = getAuth(app);
const apiKey = 'AIzaSyAGi8Ky9SrzrQEzJdIgXSe8G36J_OarSQA';

async function testUser() {
  const uid = 'HspF5FF7yDM6r743vuXn9aOuJge2'; // bnbn1@gmx.fr
  const user = await auth.getUser(uid);
  console.log("User in Auth:", user.email, "tokensValidAfterTime:", user.tokensValidAfterTime);

  // Generate a custom token and exchange for ID token via Google Identity REST API
  const customToken = await auth.createCustomToken(uid);
  const exRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: customToken, returnSecureToken: true })
  });
  const exData = await exRes.json();
  console.log("ID Token acquired. Length:", exData.idToken?.length);

  // Call Render login
  const res = await fetch('https://firebase-functions-pc5h.onrender.com/orinSecurity/api/security/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + exData.idToken
    },
    body: JSON.stringify({
      device: {
        platform: 'Android',
        appVersion: '1.6.2',
        label: 'Samsung'
      }
    })
  });

  console.log("Render Status:", res.status);
  const body = await res.text();
  console.log("Render Response:", body);
}

testUser().catch(console.error);
