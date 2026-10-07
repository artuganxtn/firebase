import {db,ref,check,type Identity} from './store';
/** All scope comes from verified Identity. There is deliberately no uid/tool URL argument. */
export type SupportToolName='getAccountStatus'|'getDepositStatus'|'getWithdrawalStatus'|'getReferralStatus'|'getActiveSessions'|'getServiceStatus'|'getPaymentStatus';
export type SupportToolResult={name:SupportToolName;state:'ready'|'unavailable';data?:unknown;asOf:number};
const safeWord=(v:unknown,max=60)=>typeof v==='string'?v.replace(/[^\p{L}\p{N} _.-]/gu,'').slice(0,max):'';
const integer=(v:unknown)=>Number.isSafeInteger(v)&&Number(v)>=0?Number(v):null;
const millis=(v:any)=>integer(v?.toMillis?.()??v);
const checked=async(u:Identity)=>{await db.runTransaction(async tx=>{await check(tx,u)})};
export async function getAccountStatus(u:Identity){
 await checked(u);const [profile,gate,accounts,security]=await Promise.all([ref('users',u.id).get(),ref('orinControlAccess',u.id).get(),ref('sparkTradingAccounts',u.id).collection('accounts').limit(20).get(),ref('orinAccountSecurity',u.id).get()]);
 return {emailVerified:u.verified,accountStatus:profile.data()?.disabled?'disabled':safeWord(gate.data()?.status)||'active',accounts:accounts.docs.filter(d=>d.data().ownerId===u.id&&['real','demo'].includes(d.data().type)).map(d=>({type:d.data().type==='real'?'real':'demo',currency:safeWord(d.data().currency,8)})),twoFactorConfigured:security.exists?security.data()?.totpEnabled===true:null};
}
async function financialStatus(u:Identity,collection:string,reference?:string){
 await checked(u);if(reference){if(!/^[A-Za-z0-9_-]{1,128}$/.test(reference))return {record:null};const doc=await ref(collection,reference).get();return {record:doc.exists&&doc.data()?.uid===u.id?financialRecord(doc.id,doc.data()!,collection==='orinDeposits'):null};}
 const rows=await db.collection(collection).where('uid','==',u.id).orderBy('createdAt','desc').limit(5).get();return {scope:'latest_five_recorded_requests_only',recent:rows.docs.filter(d=>d.data().uid===u.id).map(d=>financialRecord(d.id,d.data(),collection==='orinDeposits'))};
}
function financialRecord(id:string,d:Record<string,any>,nowpayments=false){return {reference:id,status:safeWord(d.status),currency:safeWord(d.currency??'USD',12),amountCents:integer(d.amountCents??d.cents),credited:d.credited===true,createdAt:millis(d.createdAt),updatedAt:millis(d.updatedAt),provider:nowpayments?'NOWPayments':null};}
export const getDepositStatus=(u:Identity,reference?:string)=>financialStatus(u,'orinDeposits',reference);
export const getWithdrawalStatus=(u:Identity,reference?:string)=>financialStatus(u,'orinControlWithdrawals',reference);
export async function getReferralStatus(u:Identity){await checked(u);const [member,config]=await Promise.all([ref('orinProgramMembers',u.id).get(),ref('orinProgramConfiguration','current').get()]);const d=member.data();return {enrolled:member.exists,programEnabled:config.data()?.enabled===true,invited:d?integer(d.directCount):null,successful:d?integer(d.qualifiedCount):null,paidRewardCents:d?integer(d.paidCents):null,pendingRewardCents:d?integer(d.pendingCents):null};}
export async function getActiveSessions(u:Identity){
 await checked(u);const [profile,rows]=await Promise.all([ref('orinAccountSecurity',u.id).get(),db.collection('orinSecuritySessions').where('uid','==',u.id).where('status','==','active').limit(101).get()]);const p=profile.data(),now=Date.now();
 const current=rows.docs.map(d=>d.data()).filter(d=>d.uid===u.id&&d.status==='active'&&d.expiresAtMs>now&&d.epoch===(p?.epoch??0));
 return {count:rows.size===101?null:current.length,observedActiveCount:current.length,truncated:rows.size===101,sessions:current.slice(0,10).map(d=>({platform:safeWord(d.device?.platform,20),model:safeWord(d.device?.model),createdAt:millis(d.createdAt),lastActiveAt:millis(d.lastActiveAt)}))};
}
export async function getServiceStatus(u:Identity){await checked(u);const [control,security]=await Promise.all([ref('orinControlConfiguration','current').get(),ref('system','account-security').get()]);const d=control.data();return {maintenance:d?.maintenance===true,securityServerEnabled:process.env.ORIN_ACCOUNT_SECURITY_ENABLED==='true'&&security.data()?.enabled===true&&security.data()?.rulesVersion===160,realTransferAvailable:false,liveExchangeExecutionAvailable:false};}
export async function getPaymentStatus(u:Identity){await checked(u);return {provider:'NOWPayments',depositConfigurationRequested:process.env.ORIN_DEPOSITS_ENABLED==='true',depositServiceReadiness:'check_authenticated_payment_screen',withdrawalsAvailable:false,note:'The support server cannot establish credential availability inside the separately deployed payments function.'};}
export const SUPPORT_READ_TOOLS={getAccountStatus,getDepositStatus,getWithdrawalStatus,getReferralStatus,getActiveSessions,getServiceStatus,getPaymentStatus};
export async function runSupportTool(u:Identity,name:SupportToolName,reference?:string):Promise<SupportToolResult>{
 if(!Object.hasOwn(SUPPORT_READ_TOOLS,name))return {name,state:'unavailable',asOf:Date.now()};
 try{return {name,state:'ready',data:await SUPPORT_READ_TOOLS[name](u,reference),asOf:Date.now()}}catch{return {name,state:'unavailable',asOf:Date.now()}};
}
/** Deterministic narrow tool selection, including recent context for short follow-ups. */
export function selectSupportTools(text:string):SupportToolName[]{
 const names:SupportToolName[]=['getAccountStatus','getServiceStatus'];
 if(/إيداع|ايداع|deposit|yatır|einzahl/i.test(text))names.push('getDepositStatus','getPaymentStatus');
 if(/سحب|withdraw|çek|auszahl/i.test(text))names.push('getWithdrawalStatus','getPaymentStatus');
 if(/إحالة|احالة|دعوة|referr|davet|empfehl/i.test(text))names.push('getReferralStatus');
 if(/جلس|أجهز|اجهز|session|device|oturum|gerät|sitzung/i.test(text))names.push('getActiveSessions');
 if(/دفع|payment|ödeme|zahlung/i.test(text))names.push('getPaymentStatus');
 return [...new Set(names)];
}
export async function supportToolContext(u:Identity,text:string){const deposit=text.match(/\bnp-[a-f0-9]{64}\b/i)?.[0],withdrawal=text.match(/\b[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\b/i)?.[0];return Promise.all(selectSupportTools(text).map(name=>runSupportTool(u,name,name==='getDepositStatus'?deposit:name==='getWithdrawalStatus'?withdrawal:undefined)));}
