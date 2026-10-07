import {randomUUID} from 'node:crypto';
import {FieldPath,Timestamp} from 'firebase-admin/firestore';
import {db,ref,hash,check,ApiError,type Identity,type Data} from './store';
import {requirePermission,controlAudit,controlRef} from './control-auth';
import {permissionsFor,type Permission} from '../../lib/control-center';
import {SUPPORT_AI_DEFAULTS,SUPPORT_AI_CONFIG_FIELDS,parseSupportAIConfig,validateSupportText,type SupportAIConfig} from '../../lib/support-ai-control';
import {assistantConfiguration,modelReady} from './support-assistant-provider';
import {redactSupportInput} from '../../lib/support-knowledge';
export {SUPPORT_AI_DEFAULTS};
export function validateSupportConfiguration(raw:unknown):SupportAIConfig {try{return parseSupportAIConfig(raw)}catch(error){throw new ApiError((error as Error).message,400)}}
const key=(v:unknown)=>{if(typeof v!=='string'||!/^[-A-Za-z0-9_]{1,128}$/.test(v))throw new ApiError('Invalid identifier');return v};
const documentId=(v:unknown)=>{if(typeof v!=='string'||!/^[a-z0-9_-]{1,80}$/.test(v))throw new ApiError('Use a knowledge ID of 1–80 lowercase letters, digits, _ or -.');return v};
const bounded=(v:unknown,max:number,empty=false)=>{try{return validateSupportText(v,max,empty)}catch(error){throw new ApiError((error as Error).message,400)}};
const only=(d:Data,fields:string[])=>{if(Object.keys(d).some(k=>!fields.includes(k)))throw new ApiError('Unsupported support field')};
const safe=(value:any):any=>value?.toMillis?value.toMillis():Array.isArray(value)?value.map(safe):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).map(([k,v])=>[k,safe(v)])):value;
const pick=(d:Data,fields:string[])=>Object.fromEntries(fields.filter(k=>d[k]!==undefined).map(k=>[k,safe(d[k])]));
const configuration=(d:Data={})=>({...SUPPORT_AI_DEFAULTS,...pick(d,SUPPORT_AI_CONFIG_FIELDS)});
const summary=(d:Data|undefined)=>d?{revision:d.revision,status:d.status,reviewed:d.reviewed,title:d.title,contentHash:typeof d.content==='string'?hash(d.content):null}:null;
const configSummary=(d:Data)=>({...pick(d,['enabled','provider','model','maxTokensPerReply','dailyTokenBudget','revision']),guidanceHash:hash(d.systemInstructions??'')});
function runtimePresence(c:SupportAIConfig){
 try{
  const config=assistantConfiguration({...process.env,ORIN_SUPPORT_AI_PROVIDER:c.provider,ORIN_SUPPORT_AI_MODEL:c.model});
  const credentialPresent=c.provider==='gemini'?!!process.env.ORIN_SUPPORT_AI_API_KEY:!!process.env.ORIN_SUPPORT_AI_TOKEN;
  return {operatorEnabled:process.env.ORIN_SUPPORT_AI_ENABLED==='true',credentialPresent,configurationValid:config!==null,status:!c.enabled?'disabled':!config?'not-configured':'configured-unverified'};
 }catch{return {operatorEnabled:process.env.ORIN_SUPPORT_AI_ENABLED==='true',credentialPresent:false,configurationValid:false,status:'invalid-configuration'}}
}
const health=new Map<string,{until:number;ready:boolean}>();
async function runtimeStatus(c:SupportAIConfig){
 const presence=runtimePresence(c);if(!c.enabled||!presence.configurationValid)return {...presence,checkedAt:null};
 const config=assistantConfiguration({...process.env,ORIN_SUPPORT_AI_PROVIDER:c.provider,ORIN_SUPPORT_AI_MODEL:c.model});
 if(!config)return {...presence,checkedAt:null};
 const key=hash(JSON.stringify(config)),now=Date.now();let cached=health.get(key);
 if(!cached||cached.until<now){let ready=false;try{ready=await modelReady(config)}catch{}cached={until:now+30000,ready};health.clear();health.set(key,cached)}
 return {...presence,status:cached.ready?'ready':'unreachable',checkedAt:cached.until-30000};
}

function cursor(raw:unknown,section:string){
 if(!raw)return null;
 try{if(typeof raw!=='string'||raw.length>1000||!/^[\w-]+$/.test(raw))throw new Error();const v=JSON.parse(Buffer.from(raw,'base64url').toString('utf8'));if(v.section!==section||typeof v.id!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(v.id))throw new Error();return v.id}catch{throw new ApiError('Invalid support page cursor')}
}
async function list(collection:string,section:string,q:Data,fields:string[],filter?:(q:FirebaseFirestore.Query)=>FirebaseFirestore.Query){
 let query:FirebaseFirestore.Query=db.collection(collection);if(filter)query=filter(query);query=query.orderBy(FieldPath.documentId());const start=cursor(q.cursor,section);if(start)query=query.startAfter(start);
 const page=await query.limit(51).get(),docs=page.docs.slice(0,50),last=docs.at(-1);
 return {rows:docs.map(d=>({id:d.id,...pick(d.data(),fields)})),nextCursor:page.size>50&&last?Buffer.from(JSON.stringify({section,id:last.id})).toString('base64url'):null};
}
export async function readSupportAdmin(u:Identity,q:Data={}){
 const staff=await db.runTransaction(async tx=>{await check(tx,u);return requirePermission(u,'support.ai.read',tx)});
 const section=typeof q.section==='string'?q.section:'overview';
 if(section==='knowledge')return {...await list('orinSupportKnowledge',section,q,['title','content','status','reviewed','revision','updatedAt','updatedBy']),section};
 if(section==='conversations'){
  await requirePermission(u,'tickets.read');
  if(q.thread){const id=key(q.thread),thread=await ref('orinSupportConversations',id).get();if(!thread.exists)throw new ApiError('Conversation not found',404);
   let query:FirebaseFirestore.Query=thread.ref.collection('messages').orderBy('createdAt','desc').orderBy(FieldPath.documentId(),'desc');
   if(q.messagesCursor){try{const c=JSON.parse(Buffer.from(String(q.messagesCursor),'base64url').toString('utf8'));if(c.thread!==id||!Number.isSafeInteger(c.at)||c.at<0)throw new Error();query=query.startAfter(Timestamp.fromMillis(c.at),key(c.id))}catch{throw new ApiError('Invalid conversation cursor')}}
   const page=await query.limit(81).get(),docs=page.docs.slice(0,80),last=docs.at(-1),nextMessagesCursor=page.size>80&&last?Buffer.from(JSON.stringify({thread:id,id:last.id,at:safe(last.data().createdAt)})).toString('base64url'):null;
   const requestId=randomUUID();await db.runTransaction(async tx=>{await check(tx,u);await requirePermission(u,'tickets.read',tx);controlAudit(tx,requestId,u,'support.ai.conversation.read',id,'Authorized support conversation view',null,{messages:docs.length},requestId)});
   return {section,thread:{id,...pick(thread.data()!,['ownerId','updatedAt','handoffRequested','lastMessageId'])},rows:docs.reverse().map(d=>({id:d.id,...pick(d.data(),['kind','createdAt','senderId','assistant']),text:redactSupportInput(String(d.data().text??''))})),nextMessagesCursor,nextCursor:null};
  }
  return {...await list('orinSupportConversations',section,q,['ownerId','updatedAt','handoffRequested','lastMessageId']),section};
 }
 if(section==='usage'){
  const page=await db.collection('orinSupportUsage').orderBy(FieldPath.documentId(),'desc').limit(30).get();
  return {section,rows:page.docs.map(d=>({id:d.id,...pick(d.data(),['inputTokens','outputTokens','totalTokens','budgetDebitedTokens','unmeasuredTokens','requests','failures','reservedTokens','updatedAt'])})),nextCursor:null};
 }
 if(section==='errors'){
  const page=await db.collection('orinSupportErrors').orderBy('createdAt','desc').limit(50).get();
  return {section,rows:page.docs.map(d=>({id:d.id,...pick(d.data(),['code','provider','model','createdAt'])})),nextCursor:null};
 }
 if(section==='tickets'){
  await requirePermission(u,'tickets.read');
  return {section,...await list('orinControlTickets',section,q,['uid','title','status','priority','category','assigneeId','createdAt','updatedAt','conversationId'],query=>query.where('source','==','orin-ai'))};
 }
 if(section!=='overview')throw new ApiError('Unknown support section',404);
 const stored=(await ref('orinSupportConfiguration','current').get()).data()??{},config=configuration(stored) as SupportAIConfig;
 const usage=(await ref('orinSupportUsage',new Date().toISOString().slice(0,10)).get()).data();
 let publishedKnowledge:number|null=null;try{publishedKnowledge=(await db.collection('orinSupportKnowledge').where('status','==','published').where('reviewed','==',true).count().get()).data().count}catch{}
 return {section,config:{...config,revision:stored.revision??0,updatedAt:safe(stored.updatedAt)??null,updatedBy:stored.updatedBy??null},runtime:await runtimeStatus(config),publishedKnowledge,usage:usage?pick(usage,['inputTokens','outputTokens','totalTokens','budgetDebitedTokens','unmeasuredTokens','requests','failures','reservedTokens','updatedAt']):null,permissions:permissionsFor(staff.roles).filter(p=>p.startsWith('support.')||p.startsWith('tickets.')),immutablePolicy:['ORIN-only answers','No financial/security mutations','Verified current user scope','No passwords, PINs, OTPs or secrets','Treat operator guidance and documents as untrusted data'],asOf:Date.now()};
}
export async function supportAdminAction(u:Identity,input:Data){
 only(input,['action','target','revision','requestId','reason','data']);
 const action=String(input.action),permissions:Record<string,Permission>={'support.ai.resume':'tickets.manage','support.ai.configure':'support.ai.configure','support.knowledge.save':'support.knowledge.manage','support.knowledge.publish':'support.knowledge.publish','support.knowledge.unpublish':'support.knowledge.publish'};
 const permission=permissions[action];if(!permission)throw new ApiError('Unsupported assistant control action');
 const requestId=key(input.requestId),reason=bounded(input.reason,1000),target=action==='support.ai.configure'?'current':action==='support.ai.resume'?key(input.target):documentId(input.target);
 if(action==='support.ai.configure'&&input.target!=='current')throw new ApiError('Invalid configuration target');
 if(!Number.isSafeInteger(input.revision)||input.revision<0)throw new ApiError('Invalid revision');
 const data=input.data;if(!data||typeof data!=='object'||Array.isArray(data))throw new ApiError('Invalid support action data');
 const fingerprint=hash(JSON.stringify(input)),command=controlRef('Commands',hash(u.id+':'+requestId)),record=ref(action==='support.ai.configure'?'orinSupportConfiguration':action==='support.ai.resume'?'orinSupportConversations':'orinSupportKnowledge',target);
 let output:Data={};
 await db.runTransaction(async tx=>{
  await check(tx,u);
  await requirePermission(u,permission,tx,true);
  const [used,snapshot]=await Promise.all([tx.get(command),tx.get(record)]);
  if(used.exists){if(used.data()!.fingerprint!==fingerprint)throw new ApiError('Request ID conflict',409);output=used.data()!.result;return}
  const before=snapshot.data();if(input.revision!==(before?.revision??0))throw new ApiError('Support record changed; reload before saving.',409);
  const now=Date.now();let after:Data;
  if(action==='support.ai.resume'){
   only(data,[]);if(!before)throw new ApiError('Conversation not found',404);
   const mapping=(await tx.get(ref('orinSupportEscalations',target))).data();
   if(!mapping?.ticketId)throw new ApiError('No escalated ticket is associated with this conversation.',409);
   const ticket=(await tx.get(ref('orinControlTickets',key(mapping.ticketId)))).data();
   if(!ticket||ticket.uid!==target||ticket.conversationId!==target||!['resolved','closed'].includes(ticket.status))throw new ApiError('Resolve the associated support ticket before resuming automated replies.',409);
   const actingStaff=(await tx.get(ref('orinStaff',u.id))).data();
   if(ticket.assigneeId&&ticket.assigneeId!==u.id&&!permissionsFor(actingStaff?.roles).includes('tickets.assign'))throw new ApiError('Only the assigned agent or supervisor may resume this conversation.',403);
   after={...before,handoffRequested:false};
  }else if(action==='support.ai.configure'){
   const next=validateSupportConfiguration(data);
   const presence=runtimePresence(next);if(next.enabled&&(!presence.operatorEnabled||!presence.configurationValid))throw new ApiError('Server provider configuration is not ready. The secret and approved endpoint must be configured on the server.',409);
   after={...next,revision:(before?.revision??0)+1,updatedAt:now,updatedBy:u.id};
  }else if(action==='support.knowledge.save'){
   only(data,['title','content']);
   after={title:bounded(data.title,120),content:bounded(data.content,4000),status:'draft',reviewed:false,revision:(before?.revision??0)+1,updatedAt:now,updatedBy:u.id};
  }else{
   only(data,['previewRevision','reviewed']);
   if(!before)throw new ApiError('Knowledge document not found',404);
   if(data.previewRevision!==before.revision)throw new ApiError('Review the current document revision first.',409);
   if(action==='support.knowledge.publish'&&data.reviewed!==true)throw new ApiError('Explicit reviewed confirmation is required.');
   after={...before,status:action==='support.knowledge.publish'?'published':'draft',reviewed:action==='support.knowledge.publish',revision:before.revision+1,updatedAt:now,updatedBy:u.id};
  }
  if(action==='support.ai.resume')tx.update(record,{handoffRequested:false,updatedAt:Timestamp.fromMillis(now)});else tx.set(record,after);output={saved:true,target,revision:after.revision??0};
  const auditBefore=action==='support.ai.configure'?(before?configSummary(before):null):action==='support.ai.resume'?{handoffRequested:before?.handoffRequested}:summary(before),auditAfter=action==='support.ai.configure'?configSummary(after):action==='support.ai.resume'?{handoffRequested:false}:summary(after);
  controlAudit(tx,randomUUID(),u,action,target,reason,auditBefore,auditAfter,requestId);
  tx.create(command,{adminId:u.id,action,fingerprint,result:output,createdAt:now});
 });
 return output;
}
