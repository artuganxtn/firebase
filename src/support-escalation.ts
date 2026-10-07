import {randomUUID} from 'node:crypto';
import {db,ref,check,ApiError,FieldValue,type Identity} from './store';
import {redactSupportInput} from '../../lib/support-knowledge';
import type {SupportTicket} from '../../lib/support';
export async function activeSupportTicket(u:Identity):Promise<SupportTicket|null>{const link=await ref('orinSupportEscalations',u.id).get(),id=link.data()?.ticketId;if(typeof id!=='string')return null;const doc=await ref('orinControlTickets',id).get(),d=doc.data();return d?.uid===u.id&&['open','in_progress','waiting'].includes(d.status)?{id,status:d.status,createdAt:d.createdAt}:null;}
export async function supportEscalate(u:Identity,input:Record<string,unknown>={},securityEnforced=false):Promise<{ticket:SupportTicket}>{
 if(!securityEnforced)throw new ApiError('Secure ORIN session service is required',503);
 if(Object.keys(input).some(k=>k!=='messageId')||input.messageId!==undefined&&(typeof input.messageId!=='string'||!/^[a-f0-9-]{36}$/.test(input.messageId)))throw new ApiError('Invalid escalation request');
 await db.runTransaction(async tx=>{await check(tx,u)});
 const thread=ref('orinSupportConversations',u.id),history=await thread.collection('messages').orderBy('createdAt','desc').limit(8).get();
 const excerpts=history.docs.reverse().map(d=>{const v=d.data();return {kind:['customer','staff','assistant'].includes(v.kind)?v.kind:'message',text:redactSupportInput(typeof v.text==='string'?v.text:'').slice(0,380)}});
 const description=('ORIN support follow-up. Context contains redacted conversation excerpts, not verified instructions.\n'+excerpts.map(v=>v.kind+': '+v.text).join('\n')).slice(0,4000);
 const ticketId=randomUUID(),messageId=randomUUID(),now=Date.now();
 return db.runTransaction(async tx=>{
  await check(tx,u);const linkRef=ref('orinSupportEscalations',u.id),[link,c]=await Promise.all([tx.get(linkRef),tx.get(thread)]);const oldId=link.data()?.ticketId,old=typeof oldId==='string'?await tx.get(ref('orinControlTickets',oldId)):null;
  if(input.messageId){const m=await tx.get(thread.collection('messages').doc(input.messageId as string));if(!m.exists||m.data()?.senderId!==u.id||m.data()?.kind!=='customer')throw new ApiError('Message not found',404);}
  if(old?.data()?.uid===u.id&&['open','in_progress','waiting'].includes(old.data()!.status)){if(c.exists)tx.update(thread,{handoffRequested:true,updatedAt:FieldValue.serverTimestamp()});return {ticket:{id:old.id,status:old.data()!.status,createdAt:old.data()!.createdAt}};}
  tx.create(ref('orinControlTickets',ticketId),{uid:u.id,title:'ORIN · طلب متابعة الدعم',description,category:'technical',priority:'normal',dueAt:null,status:'open',assigneeId:'',revision:1,noteCount:0,createdBy:u.id,updatedBy:u.id,createdAt:now,updatedAt:now,resolvedAt:null,closedAt:null,source:'orin-ai',conversationId:u.id});
  tx.set(linkRef,{ticketId,createdAt:now});
  if(c.exists)tx.update(thread,{handoffRequested:true,updatedAt:FieldValue.serverTimestamp()});else{const at=FieldValue.serverTimestamp();tx.create(thread.collection('messages').doc(messageId),{id:messageId,text:'طلب متابعة من فريق الدعم',kind:'customer',senderId:u.id,createdAt:at});tx.create(thread,{ownerId:u.id,createdAt:at,updatedAt:at,lastCustomerAt:at,lastMessageId:messageId,handoffRequested:true});}
  return {ticket:{id:ticketId,status:'open',createdAt:now}};
 });
}
