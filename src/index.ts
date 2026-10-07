export {orinIdentity,identityHandle} from './email-registration-http';
export {orinPayments,paymentsHandle} from './payments-http';
export {orinSecurity,securityHandle} from './account-security-http';
import {securityEnabled} from './account-security';
import {supportAssistantCapability,supportAssistantReply,supportEscalate} from './support-assistant';
import {referralSummary} from './referrals';
import {onSchedule} from 'firebase-functions/v2/scheduler';
import {deliverControlNotifications} from './control-worker';
export {deliverControlNotifications};
import {controlRead,controlAction,controlUser,acceptStaffInvitation} from './control-center';
import {controlDocument} from './control-documents';
import {controlProgramConfiguration} from './control-programs';
import {requirePermission,controlAccess} from './control-auth';
import {ref} from './store';
import {programSummary,programAction,adminPrograms,accountActivity} from './programs';
import {onRequest} from 'firebase-functions/v2/https';
import {identity,configuration,settings,ApiError} from './store';
import {action,state,verify} from './contracts';
import {saveSettings,saveConfiguration} from './settings';
import {inbox,readNotices,listCampaigns,campaign} from './notifications';
export async function handle(req:any,res:any){
 res.set('Cache-Control','private, no-store');res.set('X-Content-Type-Options','nosniff');
 try{
  const path=req.path,method=req.method,origin=req.get('origin');
  const allowedOrigins=['https://orin-99951.web.app','https://orin-99951.firebaseapp.com'];
  if(process.env.ALLOWED_ORIGINS)allowedOrigins.push(...process.env.ALLOWED_ORIGINS.split(',').map(s=>s.trim()));
  if(origin&&!allowedOrigins.includes(origin)&&!(process.env.FUNCTIONS_EMULATOR==='true'&&/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)))throw new ApiError('مصدر الطلب غير مسموح.',403);
  if(origin){res.set('Access-Control-Allow-Origin',origin);res.set('Vary','Origin');res.set('Access-Control-Allow-Headers','Authorization, Content-Type, X-Orin-Session');res.set('Access-Control-Allow-Methods','GET, POST, PATCH, OPTIONS');}
  if(method==='OPTIONS'){res.status(204).send('');return}
  if(method==='GET'&&path==='/api/health'){res.json({ok:true,app:'ORIN',backend:'firebase',mode:'production'});return}
  if(method==='GET'&&path==='/api/markets/configuration'){res.json(await configuration());return}
  if(!['GET','POST','PATCH'].includes(method))throw new ApiError('طريقة غير مدعومة.',405);
  const u=await identity(req.get('authorization'),req.get('x-orin-session'));let result:unknown;
  if(method!=='GET'&&(!req.is('application/json')||!req.body||Array.isArray(req.body)||typeof req.body!=='object'||Buffer.byteLength(JSON.stringify(req.body))>(path.startsWith('/api/control/')?50000:12000)))throw new ApiError('بيانات الطلب غير صالحة أو كبيرة.',400);
  if((path.startsWith('/api/admin/')||path==='/api/markets/configuration'&&method!=='GET')&&(await ref('system','control-center').get()).exists){if(method!=='GET')throw new ApiError('Use the audited Control Center workflow',409);await requirePermission(u,'staff.manage');}
  if(path==='/api/support/assistant'&&method==='GET')result=await supportAssistantCapability(u,securityEnabled()&&!!u.securitySessionId);
  else if(path==='/api/support/assistant'&&method==='POST'){
   const secured=securityEnabled()&&!!u.securitySessionId;
   if(String(req.get('accept')??'').includes('text/event-stream')){
    res.set('Content-Type','text/event-stream; charset=utf-8');res.set('X-Accel-Buffering','no');res.flushHeaders();
    let disconnected=false;res.on('close',()=>{disconnected=true});
    const emit=(event:string,data:unknown)=>{if(!disconnected&&!res.writableEnded)res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)};
    try{const completion=await supportAssistantReply(u,req.body,secured,{onChunk:chunk=>emit(chunk.type,chunk)});emit('complete',completion)}
    catch(error){const status=(error as {status?:number}).status;emit('error',{status:status??503,error:status?(error as Error).message:'نواجه تأخيرًا مؤقتًا في خدمة الدعم. يرجى المحاولة مرة أخرى.'})}
    finally{if(!res.writableEnded)res.end()}
    return;
   }
   result=await supportAssistantReply(u,req.body,secured);
  }
  else if(path==='/api/support/escalate'&&method==='POST')result=await supportEscalate(u,req.body,securityEnabled()&&!!u.securitySessionId);
  else if(path==='/api/control/accept-invitation'&&method==='POST')result=await acceptStaffInvitation(u);
  else if(path==='/api/control/action'&&method==='POST')result=req.body.action==='program.configure'?await controlProgramConfiguration(u,req.body):await controlAction(u,req.body);
  else if(path==='/api/control/user'&&method==='GET')result=await controlUser(u,String(req.query.uid??''));
  else if(path==='/api/control/kyc-document'&&method==='GET'){await controlDocument(u,String(req.query.id??''),String(req.query.documentId??''),res);return}
  else if(path.startsWith('/api/control/')&&method==='GET')result=await controlRead(u,path.slice('/api/control/'.length),req.query);
  else if(path==='/api/account-activity'&&method==='GET')result=await accountActivity(u,String(req.query.accountId??''));
  else if(path==='/api/referrals'&&method==='GET')result=await referralSummary(u);
  else if(path==='/api/programs'&&method==='GET')result=await programSummary(u);
  else if(path==='/api/programs'&&method==='POST')result=await programAction(u,req.body);
  else if(path==='/api/admin/programs'&&method==='GET')result=await adminPrograms(u);
  else if(path==='/api/admin/programs'&&method==='POST')result=await adminPrograms(u,req.body);
  else if(path==='/api/lab'&&method==='GET')result=await state(u);
  else if(path==='/api/lab'&&method==='POST')result=await action(u,req.body);
  else if(path==='/api/settings'&&method==='GET')result=await settings(u);
  else if(path==='/api/settings'&&method==='PATCH')result=await saveSettings(u,req.body);
  else if(path==='/api/markets/configuration'&&method==='PATCH')result=await saveConfiguration(u,req.body);
  else if(path==='/api/invitations/verify'&&method==='POST')result=await verify(u,req.body.code);
  else if(path==='/api/notifications'&&method==='GET'){const offset=Number(req.query.offset??0),key=req.query.id;if(!Number.isSafeInteger(offset)||offset<0||offset>100000||key!==undefined&&(typeof key!=='string'||key.length>200))throw new ApiError('طلب غير صالح.');result=await inbox(u,Date.now(),offset,key)}
  else if(path==='/api/notifications'&&method==='POST')result=await readNotices(u,req.body);
  else if(path==='/api/admin/notifications'&&method==='GET')result=await listCampaigns(u);
  else if(path==='/api/admin/notifications'&&method==='POST')result=await campaign(u,req.body);
  else throw new ApiError('المسار غير متاح.',404);
  res.json(result);
 }catch(error){const status=(error as {status?:number}).status;if(!status)console.error('ORIN_BACKEND_FAILURE',{name:error instanceof Error?error.name:'Unknown'});res.status(status??503).json({error:status?(error as Error).message:'تعذر الاتصال بالخدمة. أعد المحاولة.'})}
}
export const orinApi=onRequest({region:'europe-west1',memory:'256MiB',timeoutSeconds:60,minInstances:0,maxInstances:2,concurrency:20,secrets:['ORIN_SUPPORT_AI_API_KEY'],cors:false},handle);

export const orinControlNotificationWorker=onSchedule({schedule:'every 1 minutes',region:'europe-west1',memory:'256MiB',timeoutSeconds:120,maxInstances:1},async()=>{await deliverControlNotifications()});
