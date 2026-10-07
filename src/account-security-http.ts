import {onRequest} from 'firebase-functions/v2/https';
import {resolveObservedIP} from './account-security-ip';
import * as security from './account-security';
const defaultOrigins=['https://orin-99951.web.app','https://orin-99951.firebaseapp.com'];
function getAllowedOrigins(){
 const list=[...defaultOrigins];
 if(process.env.ALLOWED_ORIGINS)list.push(...process.env.ALLOWED_ORIGINS.split(',').map(s=>s.trim()));
 return list;
}
/** Never accept client-controlled X-Forwarded-For as observed IP. Proxy transport IP is labeled honestly. */
export function observedIP(req:any){return resolveObservedIP(req).ip}
export async function securityHandle(req:any,res:any){
 res.set('Cache-Control','private, no-store');res.set('X-Content-Type-Options','nosniff');res.set('Referrer-Policy','no-referrer');
 try{
  const origin=req.get('origin'),origins=getAllowedOrigins();if(origin&&!origins.includes(origin)&&!(process.env.FUNCTIONS_EMULATOR==='true'&&/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)))throw new security.SecurityError('مصدر الطلب غير مسموح.',403);
  if(origin){res.set('Access-Control-Allow-Origin',origin);res.set('Vary','Origin');res.set('Access-Control-Allow-Headers','Authorization, Content-Type, X-Orin-Session');res.set('Access-Control-Allow-Methods','GET, POST, OPTIONS');}
  if(req.method==='OPTIONS'){res.status(204).send('');return}
  await security.ensureSecurityActivation(true);
  if(!['GET','POST'].includes(req.method))throw new security.SecurityError('طريقة غير مدعومة.',405);
  if(req.method==='POST'&&(!req.is('application/json')||!req.body||Array.isArray(req.body)||typeof req.body!=='object'||Buffer.byteLength(JSON.stringify(req.body))>50_000))throw new security.SecurityError('طلب غير صالح.');
  const meta=resolveObservedIP(req),ip=meta.ip,body=req.body??{},path=req.path.replace(/^\/api\/security\/?/,'');await security.securityRequestBudget(ip);let result:any;
  if(req.method==='POST'&&path==='login'){const auth=req.get('authorization');if(!auth?.startsWith('Bearer '))throw new security.SecurityError('بيانات الدخول مطلوبة.',401);result=await security.login(auth.slice(7),body,meta)}
  else if(req.method==='POST'&&path==='login/complete')result=await security.completeLogin(body,meta);
  else if(req.method==='POST'&&path==='refresh')result=await security.refresh(body);
  else if(req.method==='POST'&&path==='passkeys/login/options')result=await security.passkeyLoginOptions(meta);
  else if(req.method==='POST'&&path==='passkeys/login/verify')result=await security.passkeyLoginVerify(body,meta);
  else{
   const c=await security.context(req.get('authorization'),req.get('x-orin-session'),meta);await security.securityActorBudget(c.uid);
   if(req.method==='GET'&&path==='state')result=await security.state(c);
   else if(req.method==='GET'&&['sessions','events'].includes(path))result=(await security.state(c))[path as 'sessions'|'events'];
   else if(req.method==='POST'){
    if(path==='logout')result=await security.revoke(c,c.sid);
    else if(path==='logout-others')result=await security.revoke(c,'others');
    else if(path==='session/revoke')result=await security.revoke(c,body.sessionId);
    else if(path==='step-up')result=await security.stepUp(c,body);
    else if(path==='totp/enroll')result=await security.enrollTotp(c,body);
    else if(path==='totp/verify')result=await security.verifyEnrollment(c,body);
    else if(path==='totp/disable')result=await security.disableTotp(c,body);
    else if(path==='recovery/regenerate')result=await security.regenerateRecovery(c,body);
    else if(path==='passkeys/options')result=await security.passkeyOptions(c,body);
    else if(path==='passkeys/verify')result=await security.verifyPasskey(c,body);
    else if(path==='passkeys/delete')result=await security.deletePasskey(c,body);
    else if(path==='passkeys/auth/options')result=await security.passkeyAuthOptions(c,body);
    else if(path==='passkeys/auth/verify')result=await security.verifyPasskeyAuth(c,body);
    else if(path==='trusted/add')result=await security.addTrusted(c,body);
    else if(path==='trusted/prove')result=await security.proveTrusted(c,body);
    else if(path==='trusted/delete')result=await security.deleteTrusted(c,body);
    else if(path==='password/change')result=await security.changePassword(c,body);
    else throw new security.SecurityError('المسار غير موجود.',404);
   }else throw new security.SecurityError('المسار غير موجود.',404);
  }res.json(result);
 }catch(error){const known=error instanceof security.SecurityError,status=known?error.status:503;if(!known)console.error('ORIN_SECURITY_FAILURE',{code:'internal',name:error instanceof Error?error.name:'Unknown'});res.status(status).json({error:known?error.message:'خدمة الأمان غير متاحة مؤقتًا.',available:false,code:known?error.code:'security-unavailable'});}
}
export const orinSecurity=onRequest({region:'europe-west1',memory:'256MiB',timeoutSeconds:60,maxInstances:3,concurrency:20,secrets:['ORIN_SECURITY_MASTER_KEY'],cors:false},securityHandle);
