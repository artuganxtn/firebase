import process from 'node:process';

process.loadEnvFile();

const apiKey = 'AIzaSyAGi8Ky9SrzrQEzJdIgXSe8G36J_OarSQA';

async function testRenderLogin() {
  console.log("=== 1. Signing in with email & password via Google Identity API ===");
  // Sign in with bnbn1@gmx.fr or test account
  // Let's create a temporary test user or sign in
  const authRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: `test_user_${Date.now()}@example.com`,
      password: 'TestPassword123!',
      returnSecureToken: true
    })
  });

  const authData = await authRes.json();
  if (!authData.idToken) {
    console.error("Auth failed:", authData);
    return;
  }
  console.log("Registered test user UID:", authData.localId);
  console.log("Got fresh ID token! Auth time is now.");

  console.log("\n=== 2. Calling Render: POST /orinSecurity/api/security/login ===");
  const renderRes = await fetch('https://firebase-functions-pc5h.onrender.com/orinSecurity/api/security/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + authData.idToken
    },
    body: JSON.stringify({
      device: {
        platform: 'Android',
        appVersion: '1.6.2',
        label: 'Samsung Galaxy'
      }
    })
  });

  console.log("Render HTTP Status:", renderRes.status);
  const renderData = await renderRes.text();
  console.log("Render Response Body:", renderData);
}

testRenderLogin().catch(console.error);
