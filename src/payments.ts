import {controlAccess,controlAccount} from './control-auth';
import {db,ref,hash,ApiError,audit,check,type Identity,type Data} from './store';
import {recordConfirmedDeposit} from './program-ingestion';
import {NowPayments,providerId,units,validIpn} from './nowpayments';
import {PAYMENT_COINS,type DepositView,type DepositStatus} from '../../lib/payments';

const safeId=(value:unknown)=>{if(typeof value!=='string'||!/^[a-zA-Z0-9_-]{1,128}$/.test(value))throw new ApiError('معرّف الحساب غير صالح.');return value};
const depositView=(d:Data):DepositView=>({id:d.id,accountId:d.accountId,amountCents:d.amountCents,coin:d.coin,status:d.status,paymentId:d.paymentId??null,address:d.address??null,payAmount:d.payAmount??null,extraId:d.extraId??null,credited:!!d.credited,createdAt:d.createdAt});
const states=new Set(['waiting','confirming','confirmed','sending','finished','partially_paid','failed','refunded','expired']);

export function paymentService(provider:Pick<NowPayments,'create'|'get'>,ipnSecret:string){
 async function create(u:Identity,input:Data):Promise<DepositView>{
  const accountId=safeId(input.accountId),requestId=safeId(input.requestId),amountCents=input.amountCents,coin=input.coin;
  if(Object.keys(input).some(k=>!['accountId','requestId','amountCents','coin'].includes(k))||!Number.isSafeInteger(amountCents)||amountCents<100000||amountCents>10000000||!PAYMENT_COINS.some(c=>c.id===coin))throw new ApiError('الحد الأدنى للإيداع 1,000 دولار أمريكي. تحقق من المبلغ والعملة.');
   // u.verified requirement removed for direct mobile access
  const id='np-'+hash(u.id+':'+requestId),r=ref('orinDeposits',id),fingerprint=hash(JSON.stringify({accountId,amountCents,coin})),now=Date.now();
  const existing=await db.runTransaction(async tx=>{
   await check(tx,u);await controlAccess(u,true,tx);await controlAccount(u.id,accountId,tx);
   const configuration=(await tx.get(ref('orinControlConfiguration','current'))).data();if(configuration&&configuration.depositsEnabled!==true)throw new ApiError('Deposit service disabled',409);
   const [old,account,access,rate]=await Promise.all([tx.get(r),tx.get(db.doc(`sparkTradingAccounts/${u.id}/accounts/${accountId}`)),tx.get(ref('orinControlAccess',u.id)),tx.get(ref('orinDepositRateLimits',u.id))]);
   if(access.data()?.status==='suspended')throw new ApiError('الحساب موقوف.',403);
   const a=account.data();if(!a||a.ownerId!==u.id||a.type!=='real'||a.currency!=='USD')throw new ApiError('الإيداع متاح للحساب الحقيقي فقط.',403);
   if(old.exists){if(old.data()!.fingerprint!==fingerprint)throw new ApiError('تغيّرت تفاصيل طلب الدفع. افتح طلبًا جديدًا.',409);return old.data()!}
   const recent=(rate.data()?.times??[]).filter((t:number)=>t>now-1800000);if(recent.length>=5)throw new ApiError('توجد طلبات دفع حديثة. راجع سجل الإيداع قبل إنشاء طلب آخر.',429);
   const d={id,uid:u.id,accountId,amountCents,coin,fingerprint,status:'creating',createdAt:now,updatedAt:now,credited:false};
   tx.create(r,d);tx.set(ref('orinDepositRateLimits',u.id),{times:[...recent,now]});audit(tx,'create-'+id,u.id,'DEPOSIT_REQUESTED',id,{accountId,amountCents,coin},now);return null;
  });
  if(existing)return depositView(existing);
  try{const payment=await provider.create(id,amountCents,coin);await reconcile(id,payment,false)}
  catch(error){
   // Unknown provider outcome must never trigger another automatic POST/payment.
   await db.runTransaction(async tx=>{const d=(await tx.get(r)).data();if(d?.status==='creating')tx.update(r,{status:'review',updatedAt:Date.now()})});
   console.error('ORIN payment create failed',{orderId:id,code:error instanceof ApiError?error.status:'network'});
  }
  return depositView((await r.get()).data()!);
 }
 async function reconcile(id:string,payment:Data,allowCredit=true){
  const r=ref('orinDeposits',safeId(id)),d=(await r.get()).data();if(!d)throw new ApiError('Unknown payment order',404);
  const pid=providerId(payment.payment_id);
  if(payment.order_id!==id||payment.price_currency!=='usd'||payment.pay_currency!==d.coin||units(payment.price_amount,2)!==BigInt(d.amountCents)||d.paymentId&&pid!==d.paymentId||payment.parent_payment_id)throw new ApiError('Payment does not match the stored order',409);
  const status:DepositStatus=states.has(payment.payment_status)?payment.payment_status:'review';
  if(typeof payment.pay_address!=='string'||!/^[a-zA-Z0-9:_-]{12,256}$/.test(payment.pay_address)||units(payment.pay_amount)<=BigInt(0))throw new ApiError('Invalid payment destination',502);
  const extra=payment.payin_extra_id??null;if(extra!==null&&(typeof extra!=='string'||extra.length>128))throw new ApiError('Invalid payment memo',502);
  // Bind provider ID exactly once, including the case where IPN won the race with POST's response.
  await db.runTransaction(async tx=>{const [fresh,owner]=await Promise.all([tx.get(r),tx.get(ref('orinPaymentIds',pid))]);const cur=fresh.data()!;
   if(owner.exists&&owner.data()!.orderId!==id||cur.paymentId&&cur.paymentId!==pid)throw new ApiError('Payment identity conflict',409);
   const reversal=cur.credited&&['refunded','failed','partially_paid'].includes(status);
   const issue=ref('orinPaymentReviews',pid),previousIssue=reversal?await tx.get(issue):null;
   tx.set(ref('orinPaymentIds',pid),{orderId:id});
   if(reversal&&!previousIssue?.exists){tx.create(issue,{orderId:id,uid:cur.uid,accountId:cur.accountId,reason:'provider_reversal_after_credit',providerStatus:status,createdAt:Date.now(),resolved:false});audit(tx,'payment-review-'+pid,'provider','PAYMENT_REVIEW_REQUIRED',id,{paymentId:pid,status},Date.now())}
   tx.update(r,{paymentId:pid,address:payment.pay_address,payAmount:String(payment.pay_amount),extraId:extra,status:reversal?'review':cur.credited?'finished':status,updatedAt:Date.now()});
  });
  if(allowCredit&&status==='finished'){
   const [profile,access]=await Promise.all([ref('users',d.uid).get(),ref('orinControlAccess',d.uid).get()]);
   const paid=units(payment.actually_paid),expected=units(payment.pay_amount);
   if(paid!==expected||profile.data()?.disabled||access.data()?.status==='suspended'){
    await db.runTransaction(async tx=>{const fresh=(await tx.get(r)).data()!;if(!fresh.credited)tx.update(r,{status:'review',reviewReason:paid!==expected?'amount_mismatch':'account_restricted'})});return;
   }
   await recordConfirmedDeposit({eventId:'nowpayments-'+pid,uid:d.uid,accountId:d.accountId,currency:'USD',cents:d.amountCents,eligible:false});
   await r.update({status:'finished',credited:true,updatedAt:Date.now()});
  }
 }
 async function get(u:Identity,id:string,refresh=false){
  const r=ref('orinDeposits',safeId(id)),d=(await r.get()).data();if(!d||d.uid!==u.id)throw new ApiError('طلب الدفع غير متاح.',404);
  if(refresh&&d.paymentId&&!d.credited){
   const permitted=await db.runTransaction(async tx=>{const current=(await tx.get(r)).data()!;if((current.refreshAfter??0)>Date.now())return false;tx.update(r,{refreshAfter:Date.now()+20000});return true});
   if(permitted)await reconcile(id,await provider.get(d.paymentId));
  }
  return depositView((await r.get()).data()!);
 }
 async function list(u:Identity,accountId:string){
  safeId(accountId);const account=(await db.doc(`sparkTradingAccounts/${u.id}/accounts/${accountId}`).get()).data();if(!account||account.ownerId!==u.id)throw new ApiError('الحساب غير متاح.',404);
  const result=await db.collection('orinDeposits').where('uid','==',u.id).where('accountId','==',accountId).orderBy('createdAt','desc').limit(20).get();return result.docs.map(d=>depositView(d.data()));
 }
 async function webhook(body:Data,signature:string){
  if(!validIpn(body,signature,ipnSecret))throw new ApiError('Invalid payment notification signature',401);
  const id=safeId(body.order_id);if(!id.startsWith('np-'))throw new ApiError('Unknown payment order',404);
  // Signed IPN triggers authoritative read; redirects and client assertions never credit funds.
  const current=await provider.get(providerId(body.payment_id));
  if(providerId(current.payment_id)!==providerId(body.payment_id))throw new ApiError('Payment identity mismatch',409);
  await reconcile(id,current);return {ok:true};
 }
 return {create,get,list,webhook};
}
