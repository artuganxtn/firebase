import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import process from 'node:process';

process.loadEnvFile();

const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
const app = getApps()[0] ?? initializeApp({ credential: cert(sa) });
const auth = getAuth(app);
const apiKey = 'AIzaSyAGi8Ky9SrzrQEzJdIgXSe8G36J_OarSQA';

async function testBnbn1Real() {
  const uid = 'HspF5FF7yDM6r743vuXn9aOuJge2'; // bnbn1@gmx.fr
  
  // Set a known test password so we can sign in with real password
  await auth.updateUser(uid, { password: 'KnownPassword123!' });
  console.log("Password updated for bnbn1@gmx.fr");

  // Sign in with email and password via REST API (exactly what client does)
  const signRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'bnbn1@gmx.fr', password: 'KnownPassword123!', returnSecureToken: true })
  });
  const signData = await signRes.json();
  console.log("Signed in with email/password!");
  console.log("ID Token acquired. auth_time is now.");

  // Call Render login
  const renderRes = await fetch('https://firebase-functions-pc5h.onrender.com/orinSecurity/api/security/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + signData.idToken
    },
    body: JSON.stringify({
      device: {
        platform: 'Android',
        appVersion: '1.6.2',
        label: 'Samsung Galaxy'
      }
    })
  });

  console.log("Render Status:", renderRes.status);
  const body = await renderRes.text();
  console.log("Render Response:", body);
}

testBnbn1Real().catch(console.error);
