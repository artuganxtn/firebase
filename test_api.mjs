import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { createSparkApi } from '../firebase-spark/adapter.js';

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

async function testApi() {
  const cred = await signInWithEmailAndPassword(auth, 'test_flow_1791390254697@example.com', 'TestPassword123!');
  console.log('Logged in UID:', cred.user.uid);

  const sparkApi = createSparkApi(db, async () => cred.user);

  console.log('1. Testing GET /api/settings...');
  try {
    const res = await sparkApi('/api/settings', { method: 'GET' });
    console.log('/api/settings STATUS:', res.status);
    const data = await res.json();
    console.log('/api/settings DATA:', JSON.stringify(data).slice(0, 100));
  } catch (e) {
    console.error('/api/settings FAILED:', e);
  }

  console.log('\n2. Testing GET /api/lab...');
  try {
    const res = await sparkApi('/api/lab', { method: 'GET' });
    console.log('/api/lab STATUS:', res.status);
    const data = await res.json();
    console.log('/api/lab DATA:', JSON.stringify(data).slice(0, 100));
  } catch (e) {
    console.error('/api/lab FAILED:', e);
  }

  console.log('\n3. Testing GET /api/experience/configuration...');
  try {
    const res = await sparkApi('/api/experience/configuration', { method: 'GET' });
    console.log('/api/experience/configuration STATUS:', res.status);
    const data = await res.json();
    console.log('/api/experience/configuration DATA:', JSON.stringify(data).slice(0, 100));
  } catch (e) {
    console.error('/api/experience/configuration FAILED:', e);
  }
}

testApi().catch(console.error);
