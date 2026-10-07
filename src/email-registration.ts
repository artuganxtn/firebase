import {createHmac,randomBytes,randomInt,timingSafeEqual} from 'node:crypto';
import type {Firestore} from 'firebase-admin/firestore';
import type {Auth} from 'firebase-admin/auth';

export class RegistrationError extends Error{constructor(public code:string,public status=400){super(code)}}
const normalize=(value:unknown)=>typeof value==='string'?value.trim().toLowerCase():'';
export const validRegistrationEmail=(value:string)=>value.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
export function codeDigest(secret:string,challenge:string,email:string,code:string){return createHmac('sha256',secret).update(JSON.stringify([challenge,email,code])).digest('hex')}
export function validChallenge(record:any,challenge:string,email:string,code:string,secret:string,now:number):'ok'|'invalid'|'expired'|'locked'|'used'{
 if(!record||record.email!==email||record.delivery!=='sent')return 'invalid';
 if(record.used)return 'used';if(record.expiresAtMs<=now)return 'expired';if(record.attempts>=5)return 'locked';
 if(typeof record.digest!=='string'||!/^[a-f0-9]{64}$/.test(record.digest))return 'invalid';
 const actual=Buffer.from(codeDigest(secret,challenge,email,code),'hex'),expected=Buffer.from(record.digest,'hex');
 return timingSafeEqual(actual,expected)?'ok':'invalid';
}
type Mailer=(input:{to:string;code:string;challengeId:string})=>Promise<void>;
/** No codes, passwords, emails or tokens are logged. Collections are server-only. */
export function emailRegistration(db:Firestore,auth:Pick<Auth,'createUser'|'createCustomToken'>,secret:string,mail:Mailer,now=Date.now){
 if(secret.length<32)throw new RegistrationError('service-unavailable',503);
 const key=(s:string)=>createHmac('sha256',secret).update(s).digest('hex');
 async function send(input:any,ip:string){
  const email=normalize(input?.email);if(!validRegistrationEmail(email))throw new RegistrationError('invalid-email');
  const id=randomBytes(24).toString('hex'),code=String(randomInt(0,1000000)).padStart(6,'0'),time=now(),challenge=db.collection('orinEmailChallenges').doc(id);
  const rates=[{key:key('email:'+email),limit:3},{key:key('ip:'+ip),limit:10},{key:'global-'+Math.floor(time/86400000),limit:200}];
  await db.runTransaction(async tx=>{
   const refs=rates.map(r=>db.collection('orinEmailRates').doc(r.key)),snapshots=await tx.getAll(...refs);
   const next=snapshots.map((s,i)=>{const data=s.data(),window=i===2?86400000:3600000;const times=(data?.times??[]).filter((n:number)=>n>time-window);
    if(times.length>=rates[i].limit||(i===0&&times.some((n:number)=>n>time-60000)))throw new RegistrationError('too-many-requests',429);
    return {times:[...times,time],expiresAt:new Date(time+86400000)};
   });
   refs.forEach((r,i)=>tx.set(r,next[i]));
   tx.create(challenge,{email,digest:codeDigest(secret,id,email,code),createdAt:time,expiresAtMs:time+600000,expiresAt:new Date(time+86400000),attempts:0,used:false,delivery:'pending'});
  });
  try{await mail({to:email,code,challengeId:id});await challenge.update({delivery:'sent'})}
  catch{await challenge.update({delivery:'failed',digest:''});throw new RegistrationError('delivery-unavailable',503)}
  return {challengeId:id,expiresIn:600,retryAfter:60};
 }
 async function register(input:any){
  const email=normalize(input?.email),name=typeof input?.name==='string'?input.name.trim():'',password=input?.password,code=input?.code,id=input?.challengeId;
  if(!validRegistrationEmail(email)||name.length<2||name.length>100||typeof password!=='string'||password.length<8||password.length>128||typeof code!=='string'||!/^\d{6}$/.test(code)||typeof id!=='string'||!/^[a-f0-9]{48}$/.test(id))throw new RegistrationError('invalid-input');
  const challenge=db.collection('orinEmailChallenges').doc(id),time=now();
  const outcome=await db.runTransaction(async tx=>{
   const r=await tx.get(challenge),record=r.data(),status=validChallenge(record,id,email,code,secret,time);
   if(status==='ok')tx.update(challenge,{used:true,usedAt:time,digest:''});
   // Commit failed guesses; throwing inside the transaction would roll them back.
   else if(record&&record.email===email&&!record.used&&record.expiresAtMs>time&&record.attempts<5)tx.update(challenge,{attempts:record.attempts+1});
   return status;
  });
  if(outcome!=='ok')throw new RegistrationError('code-'+outcome,400);
  try{
   const user=await auth.createUser({email,password,displayName:name,emailVerified:true});
   // A failed custom-token response leaves a verified account the owner can sign into.
   return {token:await auth.createCustomToken(user.uid)};
  }catch(error){const code=(error as {code?:string})?.code;
   if(code==='auth/email-already-exists')throw new RegistrationError('email-already-exists',409);
   throw new RegistrationError('registration-incomplete',503);
  }
 }
 return {send,register};
}
