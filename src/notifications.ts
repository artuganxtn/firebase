import {db,ref,account,check,bootstrap,ApiError,audit,id,notice,type Identity,type Data} from './store';
import {noticeCategory,noticeDestination} from '../../lib/notification-model';
import {safeDestination} from '../../lib/orin-routes';
function visible(n:Data,a:Data,uid:string,now:number){
 if(n.user_id!==uid&&!(n.user_id==='*'&&(n.eligibility==='all'||n.eligibility===a.tier)))return false;
 if(n.created_at>now||n.expires_at!==null&&n.expires_at<=now)return false;
 const event=n.category|| (n.id.startsWith('settle:')?'settlement':n.id.startsWith('start:')?'contract_started':n.id.startsWith('end:')?'contract_ended':'opportunity');
 return event==='security'||(a.preferences.notificationEvents?.[event]!==false&&(event!=='announcement'||a.preferences.marketingNotifications===true));
}
export async function inbox(u:Identity,now=Date.now(),offset=0,key?:string){
 await bootstrap(u,now);const [a,rows,reads]=await Promise.all([account(u.id).get(),db.collection('orinNotices').where('user_id','in',[u.id,'*']).get(),account(u.id).collection('reads').get()]);
 const profile=a.data()!,read=new Map(reads.docs.map(d=>[d.id,d.data().read_at]));
 const items=rows.docs.map(d=>d.data()).filter(n=>visible(n,profile,u.id,now)).sort((a,b)=>b.created_at-a.created_at||b.id.localeCompare(a.id)).map(n=>({...n,id:n.id,read_at:read.get(n.id)??(n.created_at<=profile.seen_at?profile.seen_at:null),category:noticeCategory(n as any),deep_link:noticeDestination(n as any)}));
 return {items:(key?items.filter(n=>n.id===key):items.slice(offset,offset+50)),unreadCount:items.filter(n=>n.read_at===null).length,total:items.length,serverTime:now,pushAvailable:false};
}
export async function readNotices(u:Identity,input:Data,now=Date.now()){
 if(input.all!==true&&(typeof input.id!=='string'||input.id.length>200||input.id.includes('/')))throw new ApiError('معرّف الإشعار مطلوب.');
 await bootstrap(u,now);await db.runTransaction(async tx=>{await check(tx,u);const a=(await tx.get(account(u.id))).data()!;
  if(input.all===true){tx.update(account(u.id),{seen_at:now});return}
  const n=(await tx.get(ref('orinNotices',input.id))).data();if(n&&visible(n,a,u.id,now))tx.set(account(u.id).collection('reads').doc(input.id),{read_at:now});
 });return inbox(u,now);
}
export async function listCampaigns(u:Identity){await db.runTransaction(tx=>check(tx,u,true));return {campaigns:(await db.collection('orinCampaigns').orderBy('created_at','desc').limit(100).get()).docs.map(d=>d.data()),pushAvailable:false,schedulerAvailable:false,audiences:{country:true,tier:true,specificUsers:true,agent:false,verified:false}}}
function matches(c:Data,a:Data){const target=JSON.parse(c.audience);return a.preferences.marketingNotifications===true&&a.preferences.notificationEvents.announcement!==false&&a.profile.closureStatus==='open'&&(!target.country||target.country===a.profile.country)&&(target.tier==='all'||target.tier===a.tier)&&(c.language==='all'||c.language===a.preferences.chartLocale)&&(!target.users.length||target.users.includes(a.id))}
async function audience(tx:FirebaseFirestore.Transaction,c:Data){const all=await tx.get(db.collection('orinAccounts').limit(1001));if(all.size>1000)throw new ApiError('الحملة تحتاج تجهيز إرسال أكبر قبل المتابعة.',409);const eligible=all.docs.filter(d=>matches(c,d.data()));if(eligible.length>200)throw new ApiError('الحد الحالي 200 مستلم للحملة. ضيّق الجمهور.',409);const profiles=eligible.length?await tx.getAll(...eligible.map(d=>ref('users',d.id))):[];return eligible.filter((d,i)=>profiles[i].exists&&profiles[i].data()?.disabled===false)}
export async function campaign(u:Identity,input:Data,now=Date.now()){
 const operation=input.action??'draft',key=typeof input.id==='string'?input.id:id();if(!/^[A-Za-z0-9_-]{1,160}$/.test(key))throw new ApiError('معرّف غير صالح.');
 const result=await db.runTransaction(async tx=>{await check(tx,u,true);const cr=ref('orinCampaigns',key),existing=(await tx.get(cr)).data();
  if(['preview','send','cancel'].includes(operation)){
   if(!existing)throw new ApiError('الحملة غير موجودة.',404);
   if(operation==='preview')return {campaign:existing,recipientCount:(await audience(tx,existing)).length};
   if(existing.revision!==input.revision||existing.status!=='draft')throw new ApiError('تغيرت الحملة أو اكتمل إرسالها. أعد التحميل.',409);
   if(operation==='cancel'){tx.update(cr,{status:'cancelled',revision:existing.revision+1});return null}
   if(input.confirmed!==true||now<existing.starts_at||now>=existing.expires_at)throw new ApiError('راجع موعد الحملة وأكّد الإرسال.',409);
   const recipients=await audience(tx,existing);if(!recipients.length||recipients.length!==input.expectedRecipients)throw new ApiError('تغير الجمهور. أعد المعاينة والتأكيد.',409);
   for(const r of recipients)notice(tx,`campaign:${key}:${r.id}`,r.id,existing.title,existing.message,null,now,{category:'announcement',deep_link:existing.deep_link,campaign_id:key,expires_at:existing.expires_at,image:existing.image||null});
   tx.update(cr,{status:'sent',revision:existing.revision+1,sent_at:now,recipient_count:recipients.length});audit(tx,`announcement:${key}`,u.id,'ANNOUNCEMENT_SENT',key,{campaignId:key,count:recipients.length},now);return null;
  }
  if(operation!=='draft'||existing&&(existing.status!=='draft'||existing.revision!==input.revision))throw new ApiError('عدّل المسودة الحالية فقط.',409);
  const title=typeof input.title==='string'?input.title.trim():'',message=typeof input.message==='string'?input.message.trim():'',a=input.audience;
  if(!title||title.length>80||!message||message.length>500)throw new ApiError('عنوان 1–80 حرفًا ورسالة 1–500 حرف.');
  if(!a||typeof a.country!=='string'||a.country!==''&&!/^[A-Z]{2}$/.test(a.country)||!['all','standard','advanced'].includes(a.tier)||!Array.isArray(a.users)||a.users.length>100||a.users.some((x:unknown)=>typeof x!=='string'||!/^[A-Za-z0-9_-]{1,160}$/.test(x)))throw new ApiError('جمهور غير صالح.');
  const startsAt=Number(input.startsAt??now),expiresAt=Number(input.expiresAt??now+7*86400000),language=input.language??'all',link=safeDestination(input.deepLink),image=String(input.image??'');
  if(!Number.isSafeInteger(startsAt)||!Number.isSafeInteger(expiresAt)||expiresAt<=Math.max(now,startsAt)||expiresAt-now>90*86400000||!['ar','en','all'].includes(language))throw new ApiError('التاريخ أو اللغة غير صالح.');
  if(input.deepLink&&link!==input.deepLink||image&&!/^\/brand\/[A-Za-z0-9/_.-]+\.(png|jpg|webp|svg)$/.test(image)||image.includes('..'))throw new ApiError('الرابط أو الصورة غير صالح.');
  const saved={id:key,title,message,image,audience:JSON.stringify(a),language,deep_link:link,starts_at:startsAt,expires_at:expiresAt,status:'draft',revision:existing?existing.revision+1:0,created_at:existing?.created_at??now,sent_at:null,recipient_count:0};tx.set(cr,saved);return {campaign:saved};
 });return result??listCampaigns(u);
}
