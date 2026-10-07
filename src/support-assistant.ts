import {randomUUID} from 'node:crypto';
import {db,ref,check,ApiError,FieldValue,type Identity} from './store';
import {SUPPORT_KNOWLEDGE_VERSION} from '../../lib/support-knowledge';
import {assistantConfiguration,generateSupportAnswer,modelReady,supportTokenReservation,SupportModelError,type AssistantConfiguration,type AssistantCompletion,type SupportGenerationInput} from './support-assistant-provider';
import {currentSupportSettings,reviewedSupportKnowledge} from './support-knowledge';
import {supportToolContext} from './support-tools';
import {activeSupportTicket,supportEscalate} from './support-escalation';
import type {SupportAssistantCapability,SupportAssistantResult} from '../../lib/support';
export {supportEscalate} from './support-escalation';
export type SupportStreamEvent={type:'status';phase:'reading'|'generating'|'saving'}|{type:'delta';text:string};
const REQUIRED_SERVICES=['Trusted ORIN API with enforced sessions and MFA','Gemini API server credential and accessible model, or a configured self-hosted inference service'];
const capability=(available:boolean,reason:SupportAssistantCapability['reason']):SupportAssistantCapability=>({available,reason,knowledgeVersion:SUPPORT_KNOWLEDGE_VERSION,requiredServices:available?[]:REQUIRED_SERVICES});
let health:{key:string;until:number;ready:boolean}|undefined;
async function currentConfiguration(securityEnforced:boolean){
 const settings=await currentSupportSettings();if(!securityEnforced)return {config:null,settings,capability:capability(false,'security_backend_required')};
 let config:AssistantConfiguration|null;try{config=assistantConfiguration({...process.env,ORIN_SUPPORT_AI_ENABLED:process.env.ORIN_SUPPORT_AI_ENABLED==='true'&&settings.enabled?'true':'false',ORIN_SUPPORT_AI_PROVIDER:settings.provider,ORIN_SUPPORT_AI_MODEL:settings.model,ORIN_SUPPORT_AI_MAX_TOKENS:String(settings.maxTokensPerReply)})}catch{return {config:null,settings,capability:capability(false,'model_configuration_invalid')}}
 if(!config)return {config:null,settings,capability:capability(false,'model_not_configured')};
 const key=config.endpoint+'\n'+config.model;if(!health||health.key!==key||health.until<Date.now()){let ready=false;try{ready=await modelReady(config)}catch{}health={key,until:Date.now()+(ready?30000:5000),ready};}
 return {config,settings,capability:capability(health.ready,health.ready?'ready':'model_unreachable')};
}
export async function supportAssistantCapability(u:Identity,securityEnforced=false){await db.runTransaction(async tx=>{await check(tx,u)});return {...(await currentConfiguration(securityEnforced)).capability,activeTicket:await activeSupportTicket(u)};}
const finishUsage=(tx:FirebaseFirestore.Transaction,job:FirebaseFirestore.DocumentData,usageDoc:FirebaseFirestore.DocumentSnapshot|undefined,usage:AssistantCompletion['usage'],failed=false)=>{
 if(!usageDoc||!job.reservedTokens)return;const d=usageDoc.data()??{},charge=usage?.totalTokens??job.reservedTokens;
 tx.set(usageDoc.ref,{inputTokens:(d.inputTokens??0)+(usage?.inputTokens??0),outputTokens:(d.outputTokens??0)+(usage?.outputTokens??0),totalTokens:(d.totalTokens??0)+(usage?.totalTokens??0),budgetDebitedTokens:(d.budgetDebitedTokens??0)+charge,unmeasuredTokens:(d.unmeasuredTokens??0)+(usage?0:charge),requests:(d.requests??0)+1,failures:(d.failures??0)+(failed?1:0),reservedTokens:Math.max(0,(d.reservedTokens??0)-job.reservedTokens),updatedAt:Date.now()},{merge:true});
};
export async function supportAssistantReply(u:Identity,input:Record<string,unknown>,securityEnforced=false,options:{onChunk?:(event:SupportStreamEvent)=>void}={}):Promise<SupportAssistantResult>{
 if(Object.keys(input).some(k=>k!=='messageId')||typeof input.messageId!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(input.messageId))throw new ApiError('Invalid support message',400);
 if(!securityEnforced)throw new ApiError('Secure ORIN session service is required',503);
 await db.runTransaction(async tx=>{await check(tx,u)});
 const emit=(event:SupportStreamEvent)=>{try{options.onChunk?.(event)}catch{/* A disconnected viewer never cancels persistence. */}};
 const messageId=input.messageId,thread=ref('orinSupportConversations',u.id),message=thread.collection('messages').doc(messageId),job=ref('orinSupportAssistantJobs',u.id).collection('messages').doc(messageId),rate=ref('orinSupportAssistantLimits',u.id);
 const {config,settings,capability:state}=await currentConfiguration(securityEnforced),now=Date.now(),responseId=randomUUID(),lease=randomUUID();
 const claim=await db.runTransaction(async tx=>{
  await check(tx,u);const [conversation,request,existing,counter]=await Promise.all([tx.get(thread),tx.get(message),tx.get(job),tx.get(rate)]);
  if(!conversation.exists||conversation.data()!.ownerId!==u.id||!request.exists||request.data()!.kind!=='customer'||request.data()!.senderId!==u.id)throw new ApiError('Message not found',404);
  if(existing.exists){const d=existing.data()!;if(d.state==='answered')return {status:'answered',replyId:d.replyId} as SupportAssistantResult;if(d.state==='handoff'||d.state==='unavailable'&&(d.retryAt??0)>now)return {status:d.state} as SupportAssistantResult;if(d.state==='processing'&&d.leaseUntil>now)return {status:'pending'} as SupportAssistantResult;}
  const stale=existing.data(),oldUsage=stale?.reservedTokens&&stale?.usageDay?await tx.get(ref('orinSupportUsage',stale.usageDay)):undefined;
  const settleStale=()=>{if(stale&&oldUsage)finishUsage(tx,stale,oldUsage,undefined,true)};
  if(conversation.data()!.handoffRequested){settleStale();if(existing.exists)tx.update(job,{state:'handoff',finishedAt:now,reservedTokens:0});return {status:'handoff'} as SupportAssistantResult;}
  if(!state.available||!config){settleStale();tx.set(job,{state:'unavailable',reason:state.reason,createdAt:now,finishedAt:now,retryAt:now+5000,knowledgeVersion:SUPPORT_KNOWLEDGE_VERSION});return {status:'unavailable'} as SupportAssistantResult;}
  const c=counter.data()??{},start=typeof c.windowStart==='number'&&now-c.windowStart<3600000?c.windowStart:now,count=start===c.windowStart?c.count??0:0;
  if(count>=20||typeof c.lastAt==='number'&&now-c.lastAt<3000||typeof c.leaseUntil==='number'&&c.leaseUntil>now)throw new ApiError('يرجى الانتظار قبل طلب إجابة أخرى. / Please wait before another assistant request.',429);
  settleStale();tx.set(rate,{windowStart:start,count:count+1,lastAt:now,leaseUntil:now+45000,lease});tx.set(job,{state:'processing',lease,leaseUntil:now+45000,replyId:responseId,createdAt:now,knowledgeVersion:SUPPORT_KNOWLEDGE_VERSION,reservedTokens:0});return null;
 });
 if(claim){if(claim.status==='handoff')return {...claim,...await supportEscalate(u,{messageId},true)};return claim;}
 let answered:AssistantCompletion|undefined;
 try{
  emit({type:'status',phase:'reading'});
  const [history,profile]=await Promise.all([thread.collection('messages').orderBy('createdAt','desc').limit(12).get(),ref('sparkProfiles',u.id).get()]);
  const messages=history.docs.reverse().map(d=>({kind:d.data().kind,text:typeof d.data().text==='string'?d.data().text:''})),query=messages.filter(m=>m.kind==='customer').slice(-3).map(m=>m.text).join('\n');
  const [knowledge,tools]=await Promise.all([reviewedSupportKnowledge(query),supportToolContext(u,query)]);
  const modelInput:SupportGenerationInput={context:{language:['ar','en','tr','de'].includes(profile.data()?.preferences?.chartLocale)?profile.data()!.preferences.chartLocale:'ar',accountTypes:[],handoffRequested:false,tools},messages,knowledge,operatorGuidance:settings.systemInstructions};
  const reservedTokens=supportTokenReservation(modelInput,config!),usageDay=new Date().toISOString().slice(0,10),usageRef=ref('orinSupportUsage',usageDay);
  await db.runTransaction(async tx=>{await check(tx,u);const [j,usage]=await Promise.all([tx.get(job),tx.get(usageRef)]);if(j.data()?.lease!==lease)throw new ApiError('Assistant request changed',409);const d=usage.data()??{};if((d.budgetDebitedTokens??d.totalTokens??0)+(d.reservedTokens??0)+reservedTokens>settings.dailyTokenBudget)throw new SupportModelError('daily_budget_exhausted');tx.set(usageRef,{reservedTokens:(d.reservedTokens??0)+reservedTokens,updatedAt:Date.now()},{merge:true});tx.update(job,{reservedTokens,usageDay,toolNames:tools.map(t=>t.name),knowledgeVersion:knowledge.version,provider:config!.provider,model:config!.model});});
  emit({type:'status',phase:'generating'});
  answered=await generateSupportAnswer(config!,modelInput,fetch,{onProgress:()=>emit({type:'status',phase:'generating'})});
  emit({type:'status',phase:'saving'});
  const result=await db.runTransaction(async tx=>{
   await check(tx,u);const [j,c,r]=await Promise.all([tx.get(job),tx.get(thread),tx.get(rate)]),d=j.data()!;const usageDoc=d.usageDay?await tx.get(ref('orinSupportUsage',d.usageDay)):undefined;
   if(d.state==='answered')return {status:'answered',replyId:d.replyId} as SupportAssistantResult;if(d.lease!==lease)return {status:'pending'} as SupportAssistantResult;
   finishUsage(tx,d,usageDoc,answered!.usage);
   if(c.data()?.handoffRequested||c.data()?.lastMessageId!==messageId){tx.update(job,{state:'handoff',finishedAt:Date.now(),reservedTokens:0});if(r.data()?.lease===lease)tx.update(rate,{leaseUntil:0});return {status:'handoff'} as SupportAssistantResult;}
   const at=FieldValue.serverTimestamp();tx.create(thread.collection('messages').doc(responseId),{id:responseId,text:answered!.text,kind:'assistant',senderId:'orin-adam',createdAt:at,assistant:{knowledgeVersion:knowledge.version,citationIds:answered!.citationIds,inReplyTo:messageId,name:'Adam'}});
   tx.update(thread,{updatedAt:at,lastMessageId:responseId,handoffRequested:answered!.handoff});tx.update(job,{state:'answered',finishedAt:Date.now(),replyId:responseId,citationIds:answered!.citationIds,handoff:answered!.handoff,scope:answered!.scope,reservedTokens:0,...(answered!.usage?{usage:answered!.usage}:{})});if(r.data()?.lease===lease)tx.update(rate,{leaseUntil:0});return {status:'answered',replyId:responseId,handoff:answered!.handoff} as SupportAssistantResult;
  });
  if(result.status==='answered'&&result.replyId===responseId)emit({type:'delta',text:answered.text});
  if(result.handoff||result.status==='handoff')return {...result,...await supportEscalate(u,{messageId},true)};return result;
 }catch(error){
  const reason=error instanceof SupportModelError?error.code:'assistant_failed';console.warn('ORIN support inference failed',{code:reason});
  await db.runTransaction(async tx=>{const [j,r]=await Promise.all([tx.get(job),tx.get(rate)]),d=j.data();const usageDoc=d?.usageDay?await tx.get(ref('orinSupportUsage',d.usageDay)):undefined;if(d?.state!=='processing'||d.lease!==lease)return;finishUsage(tx,d,usageDoc,answered?.usage,true);tx.update(job,{state:'unavailable',reason,finishedAt:Date.now(),retryAt:Date.now()+3000,leaseUntil:0,reservedTokens:0});if(r.data()?.lease===lease)tx.update(rate,{leaseUntil:0});tx.create(ref('orinSupportErrors',randomUUID()),{code:reason,createdAt:Date.now(),provider:config?.provider??'unconfigured',model:config?.model??'',uid:u.id,messageId});});
  return {status:'unavailable'};
 }
}
