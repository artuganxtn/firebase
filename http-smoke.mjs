import assert from 'node:assert/strict';
import {initializeApp,deleteApp} from 'firebase/app';
import {getAuth,connectAuthEmulator,createUserWithEmailAndPassword} from 'firebase/auth';
import {getFirestore,connectFirestoreEmulator} from 'firebase/firestore';
import {ensureAccountProfile} from '../firebase-web/account-service.ts';
const app=initializeApp({projectId:'demo-orin-auth',apiKey:'test-api-key'},'http-smoke'),auth=getAuth(app),db=getFirestore(app);connectAuthEmulator(auth,'http://127.0.0.1:9099',{disableWarnings:true});connectFirestoreEmulator(db,'127.0.0.1',8080);
try{
 const base='http://127.0.0.1:5000';
 const direct=await fetch('http://127.0.0.1:5001/demo-orin-auth/europe-west1/orinApi/api/health',{signal:AbortSignal.timeout(20000)});assert.equal(direct.status,200);console.log('Direct Function HTTP health passed.');
 const health=await fetch(base+'/api/health',{signal:AbortSignal.timeout(20000)});assert.equal(health.status,200);assert.equal((await health.json()).backend,'firebase');
 const anonymous=await fetch(base+'/api/lab');assert.equal(anonymous.status,401);
 const {user}=await createUserWithEmailAndPassword(auth,'http-'+Date.now()+'@example.test','Test-only-93!Password');await ensureAccountProfile(db,user);
 const state=await fetch(base+'/api/lab',{headers:{authorization:'Bearer '+await user.getIdToken()}});const data=await state.json();assert.equal(state.status,200,JSON.stringify(data));assert.equal(data.user.id,user.uid);assert.equal(data.balanceCents,1000000);assert.equal(data.isAdmin,false);
 const route=await fetch(base+'/settings/appearance');assert.equal(route.status,200);assert.match(route.headers.get('content-type'),/text\/html/);
 console.log('PASS: Hosting rewrite, Functions runtime, Firebase authentication, database and original-app deep route.');
}finally{await deleteApp(app)}
