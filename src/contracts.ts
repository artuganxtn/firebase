import {db,ref,account,check,bootstrap,hash,id,audit,journal,notice,active,owner,ApiError,type Identity,type Data} from './store';
import {ASSETS,resultCents} from '../../lib/contracts';
import {inbox} from './notifications';
export async function publish(u:Identity,input:Data,now=Date.now()){
 const title=typeof input.title==='string'?input.title.trim():'',asset=input.asset,direction=input.direction,duration=Number(input.durationSec),bps=Number(input.settlementBps),opensAt=Number(input.opensAt),closesAt=Number(input.closesAt),eligibility=input.eligibility??'all';
 if(!title||title.length>80||!Object.hasOwn(ASSETS,asset)||!['BUY','SELL'].includes(direction))throw new ApiError('بيانات العقد غير صالحة.');
 if(!Number.isInteger(duration)||duration<60||duration>300||!Number.isInteger(bps)||Math.abs(bps)>1000)throw new ApiError('المدة 60–300 ثانية والتسوية من ‎-10% إلى ‎+10%.');
 if(!['all','standard','advanced'].includes(eligibility)||!Number.isSafeInteger(opensAt)||!Number.isSafeInteger(closesAt)||opensAt<now-60000||closesAt<=Math.max(now,opensAt)||closesAt-opensAt>30*86400000)throw new ApiError('نافذة المشاركة أو الأهلية غير صالحة.');
 const key=id(),code=`LAB-${id().replaceAll('-','').slice(0,10).toUpperCase()}`;
 const terms={version:1,mode:'production',id:key,code,title,asset,direction,durationSec:duration,settlementBps:bps,eligibility,opensAt,closesAt,publishedAt:now,adminId:u.id},canonical=JSON.stringify(terms),digest=hash(canonical);
 await db.runTransaction(async tx=>{if((await tx.get(ref('system','control-center'))).exists)throw new ApiError('Use the audited Control Center workflow',409);await check(tx,u,true);const existing=await tx.get(ref('orinCodes',code));if(existing.exists)throw new ApiError('أعد المحاولة لإنشاء كود جديد.',409);
  tx.create(ref('orinContracts',key),{id:key,code,title,asset,direction,duration_sec:duration,settlement_bps:bps,eligibility,opens_at:opensAt,closes_at:closesAt,published_at:now,admin_id:u.id,canonical,hash:digest,participants:0});tx.create(ref('orinCodes',code),{contractId:key});
  audit(tx,`publish:${key}`,u.id,'CONTRACT_PUBLISHED_AND_LOCKED',key,{terms,sha256:digest},now);
  notice(tx,`publish:${key}`,'*','دعوة جديدة من ORIN',`${title} · الكود ${code}`,key,now,{eligibility});
 });return {id:key,code,hash:digest};
}
function integrity(c:Data){if(hash(c.canonical)!==c.hash)throw new ApiError('تعذر التحقق من سلامة العقد.',409)}
export async function verify(u:Identity,value:unknown,now=Date.now()){
 await bootstrap(u,now);if(typeof value!=='string'||!/^LAB-[A-F0-9]{10}$/.test(value.trim().toUpperCase()))throw new ApiError('كود الدعوة غير صالح.');
 const code=await ref('orinCodes',value.trim().toUpperCase()).get(),a=(await account(u.id).get()).data()!,c=code.exists?(await ref('orinContracts',code.data()!.contractId).get()).data():null;
 if(!c||c.eligibility!=='all'&&c.eligibility!==a.tier)throw new ApiError('لا توجد دعوة متاحة لحسابك بهذا الكود.',404);if((await ref('orinControlContractStates',c.id).get()).data()?.status==='revoked')throw new ApiError('Contract code revoked',409);integrity(c);return {contract:c,serverTime:now};
}
export async function join(u:Identity,input:Data,now=Date.now()){
 const code=String(input.code??'').trim().toUpperCase(),amount=Number(input.amountCents);
 if(!/^LAB-[A-F0-9]{10}$/.test(code)||!Number.isSafeInteger(amount)||amount<100||amount>100000000||input.confirmed!==true)throw new ApiError('راجع المبلغ وأكّد شروط الحساب.');
 return db.runTransaction(async tx=>{await check(tx,u,false,true);const a=(await tx.get(account(u.id))).data()!,lookup=await tx.get(ref('orinCodes',code));const c=lookup.exists?(await tx.get(ref('orinContracts',lookup.data()!.contractId))).data():null;
  if(c&&(await tx.get(ref('orinControlContractStates',c.id))).data()?.status==='revoked')throw new ApiError('Contract code revoked',409);
  if(!c||c.eligibility!=='all'&&c.eligibility!==a.tier)throw new ApiError('الدعوة غير متاحة لحسابك.',404);
  if(a.profile.closureStatus!=='open'||!a.accepted_at)throw new ApiError('يجب قبول الشروط وأن يكون الحساب مفتوحًا.',403);
  integrity(c);if(input.contractHash!==c.hash)throw new ApiError('راجع شروط العقد الحالية.',409);
  const key=hash(`position:${u.id}:${c.id}`),previous=await tx.get(ref('orinPositions',key));
  if(previous.exists){if(previous.data()!.amount_cents!==amount)throw new ApiError('سبق الاشتراك بمبلغ مختلف.',409);return {id:key,reused:true}}
  if(now<c.opens_at||now>=c.closes_at)throw new ApiError('العقد خارج نافذة المشاركة.',409);
  if(a.balanceCents<amount)throw new ApiError('الرصيد المتاح غير كافٍ.',409);
  const counterRef=ref('orinContractCounts',c.id),count=(await tx.get(counterRef)).data()?.count??0;
  const endsAt=now+c.duration_sec*1000,pnl=resultCents(amount,c.settlement_bps);
  tx.create(ref('orinPositions',key),{id:key,user_id:u.id,contract_id:c.id,amount_cents:amount,result_cents:pnl,started_at:now,ends_at:endsAt,status:'active',settled_at:null,contract:c});
  tx.update(account(u.id),{balanceCents:a.balanceCents-amount,reservedCents:a.reservedCents+amount});
  // Terms stay immutable; participation counts are computed from a separate counter.
  tx.set(counterRef,{count:count+1});
  journal(tx,`allocate:${key}`,u.id,'allocation',key,[[`user:${u.id}:cash`,-amount],[`user:${u.id}:reserved`,amount]],now,now);
  audit(tx,`join:${key}`,u.id,'AMOUNT_ALLOCATED',key,{contractId:c.id,contractHash:c.hash,amountCents:amount,startedAt:now,endsAt},now);
  notice(tx,`start:${key}`,u.id,'بدأ العقد',`${c.title}`,c.id,now);return {id:key,reused:false};
 });
}
export async function settle(u:Identity,now=Date.now()){
 const due=await db.collection('orinPositions').where('user_id','==',u.id).where('status','==','active').get();
 for(const row of due.docs){if(row.data().ends_at>now)continue;
  await db.runTransaction(async tx=>{await check(tx,u);const p=(await tx.get(row.ref)).data();if(!p||p.status!=='active'||p.ends_at>now)return;const a=(await tx.get(account(u.id))).data()!,c=(await tx.get(ref('orinContracts',p.contract_id))).data();
   if(!c)throw new ApiError('العقد غير متاح.',409);integrity(c);const expected=resultCents(p.amount_cents,c.settlement_bps);if(expected!==p.result_cents||a.reservedCents<p.amount_cents)throw new ApiError('تعارض في بيانات التسوية.',409);
   const receipt={version:1,mode:'production',receiptId:`R-${p.id.slice(0,12).toUpperCase()}`,contractId:c.id,contractCode:c.code,contractHash:c.hash,positionId:p.id,asset:c.asset,direction:c.direction,amountCents:p.amount_cents,durationSec:c.duration_sec,lockedSettlementBps:c.settlement_bps,startedAt:p.started_at,endsAt:p.ends_at,effectiveAt:p.ends_at,processedAt:now,resultCents:expected,returnedCents:p.amount_cents+expected,settlement:'executed-contract-settlement'},payload=JSON.stringify(receipt),digest=hash(payload),jid=`settle:${p.id}`;
   tx.update(account(u.id),{balanceCents:a.balanceCents+p.amount_cents+expected,reservedCents:a.reservedCents-p.amount_cents,realizedCents:a.realizedCents+expected});tx.update(row.ref,{status:'settled',settled_at:now});
   journal(tx,jid,u.id,'settlement',p.id,[[`user:${u.id}:reserved`,-p.amount_cents],[`user:${u.id}:cash`,p.amount_cents+expected],['system:trading-pnl',-expected]],p.ends_at,now);
   tx.create(ref('orinReceipts',`receipt:${p.id}`),{id:`receipt:${p.id}`,position_id:p.id,user_id:u.id,payload,hash:digest,created_at:now});
   audit(tx,jid,'settlement-engine','CONTRACT_SETTLED',p.id,{contractId:c.id,contractHash:c.hash,resultCents:expected,effectiveAt:p.ends_at,processedAt:now,receiptHash:digest},now);
   notice(tx,`end:${p.id}`,u.id,'انتهت مدة العقد',`${c.title} · اكتملت مدة المشاركة`,c.id,p.ends_at);
   notice(tx,jid,u.id,'اكتملت التسوية',`${c.title} · النتيجة ${expected>=0?'+':''}${(expected/100).toFixed(2)} دولار`,c.id,now);
  });
 }
}
export async function state(u:Identity,now=Date.now()){
 await bootstrap(u,now);const [a,p,cs,ps,rs,js,feed]=await Promise.all([account(u.id).get(),ref('users',u.id).get(),db.collection('orinContracts').orderBy('published_at','desc').limit(100).get(),db.collection('orinPositions').where('user_id','==',u.id).get(),db.collection('orinReceipts').where('user_id','==',u.id).get(),db.collection('orinJournals').where('user_id','==',u.id).get(),inbox(u,now)]);
 const user=active(p.data(),u),data=a.data()!,isAdmin=u.verified&&(user.role==='admin'||owner(u));
 const positions=ps.docs.map(d=>d.data()).sort((a,b)=>b.started_at-a.started_at).slice(0,100);
 const counts=cs.size?await db.getAll(...cs.docs.map(d=>ref('orinContractCounts',d.id))):[];
 const contracts=cs.docs.map((d,i)=>({...d.data(),participants:counts[i]?.data()?.count??0} as Data)).filter(c=>isAdmin||c.eligibility==='all'||c.eligibility===data.tier);
 const audits=isAdmin?(await db.collection('orinAudit').orderBy('created_at','desc').limit(100).get()).docs.map(d=>d.data()):[];
 return {serverTime:now,user:{id:u.id,name:user.displayName,tier:data.tier,accepted_at:data.accepted_at,seen_at:data.seen_at},isAdmin,balanceCents:data.balanceCents,reservedCents:data.reservedCents,realizedCents:data.realizedCents,contracts,positions,notifications:feed.items,receipts:rs.docs.map(d=>d.data()).sort((a,b)=>b.created_at-a.created_at).slice(0,100),ledger:js.docs.flatMap(d=>d.data().entries).sort((a,b)=>b.effective_at-a.effective_at).slice(0,300),audit:audits};
}
export async function action(u:Identity,input:Data,now=Date.now()){
 await bootstrap(u,now);await settle(u,now);let result:unknown={ok:true};
 if(input.action==='publish')result=await publish(u,input,now);
 else if(input.action==='join')result=await join(u,input,now);
 else if(input.action==='settle'){}
 else if(['accept','read','tier'].includes(input.action))await db.runTransaction(async tx=>{await check(tx,u,input.action==='tier');const a=(await tx.get(account(u.id))).data()!;
  if(input.action==='accept'&&!a.accepted_at){tx.update(account(u.id),{accepted_at:now});audit(tx,`accept:${u.id}`,u.id,'TERMS_ACCEPTED',u.id,{version:1},now)}
  if(input.action==='read')tx.update(account(u.id),{seen_at:now});
  if(input.action==='tier'){if(!['standard','advanced'].includes(input.tier))throw new ApiError('فئة غير صالحة.');tx.update(account(u.id),{tier:input.tier});audit(tx,id(),u.id,'TIER_CHANGED',u.id,{tier:input.tier},now)}
 });else throw new ApiError('عملية غير مدعومة.');
 return {result,state:await state(u,now)};
}
