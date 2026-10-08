import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import process from 'node:process';
import { securityHandle } from './lib/index.js';

process.loadEnvFile();

const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
const app = getApps()[0] ?? initializeApp({ credential: cert(sa) });
const auth = getAuth(app);

async function testLogin() {
  const uid = 'HspF5FF7yDM6r743vuXn9aOuJge2'; // The user who just created an account
  console.log("Testing login for UID:", uid);

  // Create custom token and exchange for ID token via Google REST API
  const customToken = await auth.createCustomToken(uid);
  const apiKey = 'AIzaSyAGi8Ky9SrzrQEzJdIgXSe8G36J_OarSQA';
  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: customToken, returnSecureToken: true })
  });
  const data = await res.json();
  console.log("ID Token acquired:", !!data.idToken);

  // Mock Express request and response
  const req = {
    method: 'POST',
    url: '/api/security/login',
    path: '/api/security/login',
    is: (type) => type === 'application/json',
    headers: {
      'content-type': 'application/json',
      'authorization': 'Bearer ' + data.idToken,
      'host': 'firebase-functions-pc5h.onrender.com'
    },
    get: function(h) { return this.headers[h.toLowerCase()]; },
    body: { device: { platform: 'Android', appVersion: '1.6.2' } }
  };

  const resMock = {
    headers: {},
    statusCode: 200,
    set: function(k, v) { this.headers[k] = v; return this; },
    status: function(c) { this.statusCode = c; return this; },
    json: function(j) { console.log(`[RESPONSE ${this.statusCode}]:`, JSON.stringify(j, null, 2)); },
    send: function(s) { console.log(`[RESPONSE ${this.statusCode}]:`, s); }
  };

  await securityHandle(req, resMock);
}

testLogin().catch(console.error);
