import {type DecodedIdToken} from 'firebase-admin/auth';
import {FieldValue,type Transaction} from 'firebase-admin/firestore';
import {createHash,randomUUID} from 'node:crypto';
import {adminApp as app, adminDb as db, adminAuth as auth} from './firebase-admin-init';
import {DEFAULT_PREFERENCES,DEFAULT_CONFIGURATION,CAPABILITIES,parsePreferences} from '../../lib/preferences';
import {securityEnabled,enforceSecuritySession} from './account-security';
export {app, db, auth};
export const OWNER='khtaub7341@gmail.com';
export type Data=Record<string,any>;
export type Identity={id:string;name:string;email:string;verified:boolean;authTime?:number;securitySessionId?:string};
export class ApiError extends Error {constructor(message:string,public status=400){super(message)}}
export const hash=(text:string)=>createHash('sha256').update(text).digest('hex');
export const id=()=>randomUUID();
export const ref=(collection:string,key:string)=>db.collection(collection).doc(key);
export const account=(uid:string)=>ref('orinAccounts',uid);
export const configRef=()=>ref('orinConfiguration','markets');
export const owner=(u:Identity)=>u.verified&&u.email===OWNER;
export function active(profile:Data|undefined,u:Identity,admin=false){
 if(!profile||profile.uid!==u.id||profile.email!==u.email||profile.disabled)throw new ApiError('الوصول إلى الحساب غير متاح.',403);
 if(admin&&!(u.verified&&(profile.role==='admin'||owner(u))))throw new ApiError('هذه العملية للإدارة فقط.',403);
 return profile;
}
export async function check(tx:Transaction,u:Identity,admin=false,financial=false){
 const [p,access,revoked]=await Promise.all([tx.get(ref('users',u.id)),tx.get(ref('orinControlAccess',u.id)),tx.get(ref('orinControlSessionRevocations',u.id))]);
 if(securityEnabled()||u.securitySessionId){
  if(!u.securitySessionId)throw new ApiError('يجب إكمال تحقق جلسة ORIN.',401);
  const [sessionDoc,securityDoc]=await Promise.all([tx.get(ref('orinSecuritySessions',u.securitySessionId)),tx.get(ref('orinAccountSecurity',u.id))]);
  const session=sessionDoc.data();
  if(!session||session.uid!==u.id||session.status!=='active'||session.expiresAtMs<=Date.now()||session.epoch!==(securityDoc.data()?.epoch??0))throw new ApiError('تم إبطال جلسة ORIN.',401);
 }
 const profile=active(p.data(),u);
 if(access.data()?.status==='suspended'||financial&&access.data()?.status==='restricted')throw new ApiError('Account restricted',403);
 if(revoked.exists&&(!u.authTime||u.authTime*1000<=revoked.data()!.validAfter))throw new ApiError('Session revoked',401);
 if(financial&&(await tx.get(ref('orinControlConfiguration','current'))).data()?.maintenance)throw new ApiError('Maintenance',503);
 if(admin&&(await tx.get(ref('system','control-center'))).exists){const staff=(await tx.get(ref('orinStaff',u.id))).data();if(!u.verified||staff?.status!=='active'||!staff.roles?.includes('super_admin')||staff.email!==u.email||staff.validAfter&&(!u.authTime||u.authTime*1000<=staff.validAfter))throw new ApiError('Control Center authorization required',403);return profile;}
 return active(profile,u,admin);
}
export async function identity(header:string|undefined,securityAccess?:string):Promise<Identity>{
 if(!header?.startsWith('Bearer '))throw new ApiError('سجّل الدخول للمتابعة.',401);
 let token:DecodedIdToken;try{token=await auth.verifyIdToken(header.slice(7),true)}catch{throw new ApiError('انتهت جلسة الدخول. سجّل الدخول مجددًا.',401)}
 if(!token.email)throw new ApiError('البريد الإلكتروني مطلوب.',403);
 let session:any;
 const activation=(await ref('system','account-security').get()).data();
 if(securityEnabled()||activation?.enabled===true){
  // An enabled deployment marker cannot silently downgrade to legacy password-only
  // API access because an environment flag was omitted during a later deployment.
  if(!securityEnabled()||activation?.enabled!==true||activation?.rulesVersion!==160)throw new ApiError('لم يكتمل تفعيل خادم الأمان وقواعد الوصول.',503);
   if(securityAccess){
    try{session=await enforceSecuritySession(token,securityAccess)}catch(error){throw new ApiError('جلسة ORIN غير صالحة أو تم إبطالها.',(error as {status?:number}).status??401)}
    if(Date.now()-session.lastActiveAt>60_000)await ref('orinSecuritySessions',String(token.sid)).update({lastActiveAt:Date.now()});
   }
 }
 const u:Identity={id:token.uid,email:token.email,verified:token.email_verified===true,name:typeof token.name==='string'?token.name:'مستخدم ORIN',authTime:session?Math.floor(session.createdAt/1000):token.auth_time,...(session?{securitySessionId:String(token.sid)}:{})};
 active((await ref('users',u.id).get()).data(),u);const revoked=(await ref('orinControlSessionRevocations',u.id).get()).data();if(revoked&&token.auth_time*1000<=revoked.validAfter)throw new ApiError('Session revoked',401);const access=(await ref('orinControlAccess',u.id).get()).data();if(access?.status==='suspended')throw new ApiError('Account suspended',403);return u;
}
export function journal(tx:Transaction,key:string,uid:string,kind:string,reference:string,entries:[string,number][],effective:number,now:number){
 if(entries.some(([,v])=>!Number.isSafeInteger(v))||entries.reduce((s,[,v])=>s+v,0)!==0)throw new ApiError('تعذر التحقق من قيد الحساب.',409);
 tx.create(ref('orinJournals',key),{id:key,user_id:uid,kind,reference,effective_at:effective,created_at:now,status:'posted',entries:entries.filter(([,n])=>n!==0).map(([account,amount_cents],i)=>({id:`${key}:${i}`,journal_id:key,account,amount_cents,kind,effective_at:effective}))});
}
export function audit(tx:Transaction,key:string,actor:string,action:string,reference:string,data:unknown,now:number){const payload=JSON.stringify(data);tx.create(ref('orinAudit',key),{id:key,actor_id:actor,action,reference,payload,payload_hash:hash(payload),created_at:now})}
export function notice(tx:Transaction,key:string,uid:string,title:string,message:string,contractId:string|null,now:number,extra:Data={}){tx.create(ref('orinNotices',key),{id:key,user_id:uid,title,message,contract_id:contractId,created_at:now,eligibility:'all',category:'',deep_link:contractId?`/contracts/${contractId}`:'/notifications',expires_at:null,image:null,...extra})}
export async function bootstrap(u:Identity,now=Date.now()){
 await db.runTransaction(async tx=>{const p=await check(tx,u);const a=await tx.get(account(u.id));if(a.exists)return;
  tx.create(account(u.id),{id:u.id,name:p.displayName,tier:'standard',accepted_at:null,seen_at:0,balanceCents:0,reservedCents:0,realizedCents:0,preferences:DEFAULT_PREFERENCES,profile:{displayName:p.displayName,phone:'',country:'',closureStatus:'open'},revision:0,created_at:now,updated_at:now});
  audit(tx,`account:${u.id}`,u.id,'ACCOUNT_CREATED',u.id,{initialCents:0},now);
 });
}
export const configData=(s:Data|undefined)=>({configuration:s?.configuration??structuredClone(DEFAULT_CONFIGURATION),configurationRevision:s?.revision??0,updatedAt:s?.updated_at??0,capabilities:{...CAPABILITIES,password:true}});
export async function configuration(){return configData((await configRef().get()).data())}
export async function settings(u:Identity){await bootstrap(u);const [a,p,c]=await Promise.all([account(u.id).get(),ref('users',u.id).get(),configuration()]);const profile=active(p.data(),u);const data=a.data()!;return {...c,preferences:parsePreferences(data.preferences,c.configuration),profile:{...data.profile,displayName:profile.displayName},revision:data.revision,updatedAt:data.updated_at,isAdmin:u.verified&&(profile.role==='admin'||owner(u)),email:u.email,clientId:u.id}}
export {FieldValue};
