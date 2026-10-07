import {onRequest} from 'firebase-functions/v2/https';
import {defineSecret,defineString} from 'firebase-functions/params';
import {getAuth} from 'firebase-admin/auth';
import {db} from './store';
import {emailRegistration,RegistrationError} from './email-registration';
const key=defineSecret('ORIN_MAIL_API_KEY'),pepper=defineSecret('ORIN_EMAIL_CODE_SECRET');
const from=defineString('ORIN_MAIL_FROM',{default:''}),enabled=defineString('ORIN_EMAIL_CODES_ENABLED',{default:'false'});
const defaultOrigins=['https://orin-99951.web.app','https://orin-99951.firebaseapp.com'];
function getAllowedOrigins(){
 const list=[...defaultOrigins];
 if(process.env.ALLOWED_ORIGINS)list.push(...process.env.ALLOWED_ORIGINS.split(',').map(s=>s.trim()));
 return list;
}
export async function identityHandle(req:any,res:any){
 res.set('Cache-Control','private, no-store');res.set('X-Content-Type-Options','nosniff');
 try{
  const origin=req.get('origin'),allowed=getAllowedOrigins();
  if(origin&&!allowed.includes(origin)&&!(process.env.FUNCTIONS_EMULATOR==='true'&&/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)))throw new RegistrationError('origin-denied',403);
  if(origin){res.set('Access-Control-Allow-Origin',origin);res.set('Vary','Origin');res.set('Access-Control-Allow-Headers','Content-Type');res.set('Access-Control-Allow-Methods','POST, OPTIONS')}
  if(req.method==='OPTIONS'){res.status(204).send('');return}
  const getKey=()=>{try{return key.value()||process.env.ORIN_MAIL_API_KEY||''}catch{return process.env.ORIN_MAIL_API_KEY||''}};
  const getPepper=()=>{try{return pepper.value()||process.env.ORIN_EMAIL_CODE_SECRET||''}catch{return process.env.ORIN_EMAIL_CODE_SECRET||''}};
  const getFrom=()=>{try{return from.value()||process.env.ORIN_MAIL_FROM||''}catch{return process.env.ORIN_MAIL_FROM||''}};
  const getEnabled=()=>{try{return enabled.value()||process.env.ORIN_EMAIL_CODES_ENABLED||'false'}catch{return process.env.ORIN_EMAIL_CODES_ENABLED||'false'}};
  const keyVal=getKey(),pepperVal=getPepper(),fromVal=getFrom(),enabledVal=getEnabled();
  if(enabledVal!=='true'||!keyVal||pepperVal.length<32||!fromVal)throw new RegistrationError('service-unavailable',503);
  if(req.method!=='POST')throw new RegistrationError('method-not-allowed',405);
  if(!req.is('application/json')||!req.body||typeof req.body!=='object'||Array.isArray(req.body)||Buffer.byteLength(JSON.stringify(req.body))>4000)throw new RegistrationError('invalid-input');
  const service=emailRegistration(db,getAuth(),pepperVal,async({to,code,challengeId})=>{
   const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+keyVal,'Content-Type':'application/json','Idempotency-Key':'orin-code/'+challengeId},body:JSON.stringify({from:fromVal,to:[to],subject:'ORIN - رمز التحقق',text:`رمز التحقق لإنشاء حساب ORIN: ${code}\nينتهي خلال 10 دقائق. لا تشارك الرمز مع أي شخص.\nYour ORIN verification code: ${code}. Expires in 10 minutes.`,html:`<div dir="rtl" style="font-family:Arial,sans-serif;background:#f0f7ff;padding:32px;color:#101942"><h1 style="color:#087eff">ORIN</h1><h2>تأكيد بريدك الإلكتروني</h2><p>رمز إنشاء الحساب الخاص بك</p><div dir="ltr" style="font-size:36px;letter-spacing:8px;background:white;border-radius:16px;padding:20px;text-align:center">${code}</div><p>صالح لمدة 10 دقائق. لا تشارك الرمز مع أي شخص.</p><p>إذا لم تطلب إنشاء حساب، يمكنك تجاهل هذه الرسالة.</p></div>`}),signal:AbortSignal.timeout(12000),redirect:'error'});
   if(!response.ok)throw new Error('Mail provider unavailable');
  });
  if(req.path==='/send-code'){res.json(await service.send(req.body,req.ip||'unknown'));return}
  if(req.path==='/register'){res.json(await service.register(req.body));return}
  throw new RegistrationError('not-found',404);
 }catch(error){res.status(error instanceof RegistrationError?error.status:503).json({code:error instanceof RegistrationError?error.code:'service-unavailable'})}
}
export const orinIdentity=onRequest({region:'europe-west1',memory:'256MiB',timeoutSeconds:45,minInstances:0,maxInstances:2,concurrency:10,cors:false,secrets:[key,pepper]},identityHandle);
