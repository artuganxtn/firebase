import {controlAccess,controlAccount,controlAudit,requirePermission} from './control-auth';
import {randomBytes} from 'node:crypto';
import {db,ref,check,audit,hash,ApiError,type Identity,type Data} from './store';
import {DEFAULT_PROGRAM_CONFIG,TEAM_LEVELS,BADGES,teamProgress,type ProgramConfig,type ProgramSummary} from '../../lib/programs';
const member=(uid:string)=>ref('orinProgramMembers',uid);
const configRef=()=>ref('orinProgramConfiguration','current');
const accountRef=(uid:string,id:string)=>db.doc(`sparkTradingAccounts/${uid}/accounts/${id}`);
const uidOk=(s:unknown):s is string=>typeof s==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(s);
const money=(n:unknown)=>Number.isSafeInteger(n)&&Number(n)>=0&&Number(n)<=Number.MAX_SAFE_INTEGER/4;
export function validConfig(v:Data):ProgramConfig{
 const p={...DEFAULT_PROGRAM_CONFIG,...v};
 if(Object.keys(v).some(k=>!Object.hasOwn(DEFAULT_PROGRAM_CONFIG,k))||typeof p.enabled!=='boolean'||!Number.isInteger(p.revision)||p.revision<0)throw new ApiError('Invalid program settings');
 for(const k of ['termsVersion','referralCriteria','activeTeamCriteria','activityPeriod','bonusTradingTerms','agencyCriteria'] as const)if(p[k]!==null&&(typeof p[k]!=='string'||!p[k]!.trim()||p[k]!.length>2000))throw new ApiError('Invalid terms');
 if(p.bonusDurationDays!==null&&(!Number.isInteger(p.bonusDurationDays)||p.bonusDurationDays<=0))throw new ApiError('Invalid duration');
 if(p.bonusProfitLimitCents!==null&&!money(p.bonusProfitLimitCents))throw new ApiError('Invalid profit limit');
 if(p.eligibleAssets!==null&&(!Array.isArray(p.eligibleAssets)||!p.eligibleAssets.length||p.eligibleAssets.some(x=>typeof x!=='string'||!/^[A-Z0-9-]{3,20}$/.test(x))))throw new ApiError('Invalid eligible assets');
 if(!p.badgeCriteria||typeof p.badgeCriteria!=='object'||Array.isArray(p.badgeCriteria)||Object.entries(p.badgeCriteria).some(([k,x])=>!BADGES.some(b=>b.id===k)||typeof x!=='string'||x.length>2000))throw new ApiError('Invalid badge criteria');
 for(const key of ['bonusAmountCents','referralAmountCents','firstDepositCents'] as const)if(!money(p[key])||p[key]<=0)throw new ApiError('Invalid program amount');
 if(p.requireKyc!==true)throw new ApiError('Required verification cannot be bypassed');
 if(!Array.isArray(p.levels)||p.levels.length!==6||p.levels.some((l,i)=>l.level!==i+1||!Number.isInteger(l.direct)||l.direct<1||!Number.isInteger(l.active)||l.active<l.direct||!Number.isInteger(l.bps)||l.bps<0||l.bps>10000||!money(l.capCents)||i>0&&(l.direct<p.levels[i-1].direct||l.active<p.levels[i-1].active)))throw new ApiError('Invalid L1-L6 definition');
 if(p.enabled&&(['termsVersion','referralCriteria','activeTeamCriteria','activityPeriod','bonusTradingTerms','agencyCriteria','bonusDurationDays','bonusProfitLimitCents','eligibleAssets'] as const).some(k=>p[k]===null))throw new ApiError('اعتمد جميع شروط البرنامج قبل التفعيل. / Complete program terms before activation.',409);
 return p;
}
function enabled(c:Data|undefined):ProgramConfig{const p=validConfig(c??{});if(!p.enabled)throw new ApiError('البرنامج غير مفعّل بعد. / Program is not active.',409);return p}
function cleanKey(v:unknown):string{if(typeof v!=='string'||!/^[-a-zA-Z0-9_]{1,128}$/.test(v))throw new ApiError('Invalid reference');return v}
function requireReal(a:Data|undefined,uid:string){if(!a||a.ownerId!==uid||a.type!=='real'||a.currency!=='USD')throw new ApiError('اختر حسابًا حقيقيًا بالدولار. / Select a real USD account.',409);return a}
function ledger(tx:any,key:string,uid:string,accountId:string,kind:string,cents:number,now:number){if(!Number.isSafeInteger(cents))throw new ApiError('Invalid ledger amount');tx.create(ref('orinProgramLedger',key),{uid,accountId,kind,entries:[{account:`customer:${uid}:${accountId}`,cents},{account:`program:${kind}`,cents:-cents}],createdAt:now})}
export async function programSummary(u:Identity):Promise<ProgramSummary>{
 const [config,m,b,children,rewards]=await Promise.all([configRef().get(),member(u.id).get(),ref('orinBonusWallets',u.id).get(),db.collection('orinProgramMembers').where('ancestors','array-contains',u.id).limit(101).get(),db.collection('orinReferralRewards').where('referrerId','==',u.id).limit(100).get()]);
 const c=validConfig(config.data()??{}),d=m.data(),wallet=b.data();const accounts=wallet?await accountRef(u.id,wallet.accountId).get():null;
 const rows=children.docs.slice(0,100).map(x=>({uid:x.id,...x.data()} as Data)).sort((a,b)=>a.ancestors.length-b.ancestors.length||a.referralId.localeCompare(b.referralId));
 // Team counts for qualifications are trusted aggregates, never inferred from a capped tree.
 return {available:true,config:c,member:d?{referralId:d.referralId,code:d.code,agencyId:d.agencyId??null,agencyGranted:d.agencyGranted===true,badges:d.badges??[],direct:d.directCount??0,activeTeam:d.activeTeamCount??0,team:d.teamCount??0,qualified:d.qualifiedCount??0,paidCents:d.paidCents??0,pendingCents:d.pendingCents??0,activityRewardCents:d.activityRewardCents??0}:null,bonus:wallet?{firstDepositCents:wallet.firstDepositCents??100000,termsVersion:wallet.termsVersion,accountId:wallet.accountId,cashCents:accounts?.data()?.balanceCents??0,bonusCents:wallet.bonusCents,profitCents:wallet.profitCents,withdrawableProfitCents:wallet.withdrawableProfitCents,qualifiedDepositCents:wallet.qualifiedDepositCents,claimed:wallet.claimed,eligible:true}:null,tree:rows.map(x=>({id:x.referralId,parentId:x.parentReferralId??null,depth:x.ancestors.length-(x.ancestors.indexOf(u.id)),status:x.referralStatus??'pending'})),rewards:rewards.docs.map(x=>({id:x.id,status:x.data().status,amountCents:x.data().amountCents})),truncated:children.size>100};
}
export async function programAction(u:Identity,input:Data){
 const action=input.action,requestId=cleanKey(input.requestId),now=Date.now();
 if(!['enroll','claim_bonus'].includes(action))throw new ApiError('Invalid program action');
 const request=ref('orinProgramCommands',hash(u.id+':'+requestId)),fingerprint=hash(JSON.stringify(input));
 const generatedCode='ORIN-'+randomBytes(6).toString('hex').toUpperCase();
 await db.runTransaction(async tx=>{
  await check(tx,u);await controlAccess(u,true,tx);const operational=(await tx.get(ref('orinControlConfiguration','current'))).data();if(operational&&(action==='enroll'&&!operational.referralsEnabled||action==='claim_bonus'&&!operational.bonusEnabled))throw new ApiError('Program feature is disabled',409);const old=await tx.get(request);if(old.exists){if(old.data()!.fingerprint!==fingerprint)throw new ApiError('Request already used',409);return}
  const c=enabled((await tx.get(configRef())).data()),m=await tx.get(member(u.id));
  if(action==='enroll'){
   if(m.exists)throw new ApiError('عضويتك موجودة بالفعل. / Already enrolled.',409);
   const identity=await tx.get(ref('orinReferralIdentities',u.id)),code=identity.data()?.code??generatedCode;
   const codeDoc=ref('orinReferralCodes',code),claim=await tx.get(codeDoc);if(claim.exists&&claim.data()?.uid!==u.id)throw new ApiError('Retry enrollment',409);
   const attribution=(await tx.get(ref('orinReferralAttributions',u.id))).data();if(attribution?.code&&input.referralCode&&input.referralCode!==attribution.code)throw new ApiError('Referral attribution is already recorded',409);const referralCode=attribution?.code??input.referralCode;
   let parent:Data|undefined,parentUid:string|null=null;let ancestors:string[]=[];
   if(referralCode){if(typeof referralCode!=='string'||!/^ORIN-[A-F0-9]{12}$/.test(referralCode))throw new ApiError('Invalid referral code');const sponsor=(await tx.get(ref('orinReferralCodes',referralCode))).data();if(!sponsor||sponsor.uid===u.id)throw new ApiError('Self referral or unknown code',409);parentUid=sponsor.uid;parent=(await tx.get(member(parentUid!))).data();if(!parent||parent.ancestors.includes(u.id)||parent.ancestors.length>=32)throw new ApiError('Invalid referral path');ancestors=[...parent.ancestors,parentUid!];}
   const parentDocs=await Promise.all(ancestors.map(id=>tx.get(member(id))));
   tx.create(member(u.id),{uid:u.id,referralId:code,code,parentUid,parentReferralId:parent?.referralId??null,ancestors,referralStatus:'pending',badges:['new_user'],agencyGranted:false,agencyId:null,directCount:0,teamCount:0,activeTeamCount:0,qualifiedCount:0,paidCents:0,pendingCents:0,activityRewardCents:0,createdAt:now,termsVersion:c.termsVersion});if(!claim.exists)tx.create(codeDoc,{uid:u.id});
   parentDocs.forEach(p=>tx.update(p.ref,{teamCount:(p.data()!.teamCount??0)+1,...(p.id===parentUid?{directCount:(p.data()!.directCount??0)+1}:{})}));
   if(parentUid)tx.create(ref('orinReferralRewards',u.id),{referrerId:parentUid,referredId:u.id,status:'pending',amountCents:c.referralAmountCents,createdAt:now,termsVersion:c.termsVersion,configurationRevision:c.revision});
  }else{
   if(!m.exists)throw new ApiError('Enroll first',409);
   const id=cleanKey(input.accountId);await controlAccess(u,true,tx);await controlAccount(u.id,id,tx);const a=requireReal((await tx.get(accountRef(u.id,id))).data(),u.id),v=(await tx.get(ref('orinVerifiedCustomers',u.id))).data();
   if(!v?.verified||v.revoked||!v.customerKey)throw new ApiError('التحقق المطلوب غير مكتمل. / Required verification is incomplete.',409);
   const claim=ref('orinBonusClaims',v.customerKey),wallet=ref('orinBonusWallets',u.id);if((await tx.get(claim)).exists||(await tx.get(wallet)).exists)throw new ApiError('البونص مرة واحدة لكل عميل. / Bonus already claimed.',409);
   const funding=(await tx.get(ref('orinQualifiedDeposits',u.id))).data();
   tx.create(claim,{uid:u.id,accountId:id,createdAt:now});tx.create(wallet,{uid:u.id,accountId:id,bonusCents:c.bonusAmountCents,firstDepositCents:c.firstDepositCents,configurationRevision:c.revision,profitCents:0,withdrawableProfitCents:0,qualifiedDepositCents:(funding?.cents??0)>=c.firstDepositCents?funding?.cents:0,claimed:true,claimedAt:now,expiresAt:now+c.bonusDurationDays!*86400000,termsVersion:c.termsVersion,eligibleAssets:c.eligibleAssets,profitLimitCents:c.bonusProfitLimitCents,tradingTerms:c.bonusTradingTerms});ledger(tx,'bonus-'+hash(u.id),u.id,id,'nonwithdrawable_bonus',c.bonusAmountCents,now);
  }
  tx.create(request,{fingerprint,uid:u.id,action,createdAt:now});audit(tx,'program-'+request.id,u.id,action,u.id,{requestId,termsVersion:c.termsVersion},now);
 });return programSummary(u);
}
export async function adminPrograms(u:Identity,input?:Data){
 if(!input){await db.runTransaction(tx=>check(tx,u,true));const [c,r,m,a]=await Promise.all([configRef().get(),db.collection('orinReferralRewards').limit(100).get(),db.collection('orinProgramMembers').limit(100).get(),db.collection('orinAudit').orderBy('created_at','desc').limit(50).get()]);return {configuration:validConfig(c.data()??{}),rewards:r.docs.map(x=>({id:x.id,...x.data()})),members:m.docs.map(x=>({id:x.id,...x.data()})),audit:a.docs.map(x=>x.data())}}
 const requestId=cleanKey(input.requestId),command=ref('orinProgramCommands','admin-'+hash(u.id+requestId)),fingerprint=hash(JSON.stringify(input)),now=Date.now();
 await db.runTransaction(async tx=>{
  await check(tx,u,true);const used=await tx.get(command);if(used.exists){if(used.data()!.fingerprint!==fingerprint)throw new ApiError('Request already used',409);return}
  const cfg=(await tx.get(configRef())).data()??DEFAULT_PROGRAM_CONFIG;
  if(input.action==='configure'){
   if(input.revision!==cfg.revision)throw new ApiError('Settings changed; reload',409);
   const next=validConfig({...input.configuration,revision:cfg.revision+1});if(next.termsVersion===cfg.termsVersion&&JSON.stringify(next)!==JSON.stringify({...cfg,revision:next.revision}))throw new ApiError('Use a new terms version for changed entitlements',409);tx.create(ref('orinProgramConfigurationHistory',String(next.revision)),{...next,adminId:u.id,reason:input.reason??'Legacy configuration',effectiveAt:now});tx.set(configRef(),next);controlAudit(tx,'program-config-'+command.id,u,'program.configure','programs',input.reason??'Legacy configuration',cfg,next,requestId);
  }else{
   const c=enabled(cfg),target=cleanKey(input.uid),m=(await tx.get(member(target))).data();if(!m)throw new ApiError('Unknown program member');
   if(input.action==='agency'){
    if(typeof input.grant!=='boolean'||typeof input.reason!=='string'||!input.reason.trim())throw new ApiError('Grant and review reason required');
    tx.update(member(target),{agencyGranted:input.grant,agencyId:m.agencyId??'AG-'+randomBytes(6).toString('hex').toUpperCase(),agencyReason:input.reason,agencyGrantedBy:u.id,agencyUpdatedAt:now});
   }else if(input.action==='badge'){
    const badge=BADGES.find(b=>b.id===input.badge);if(!badge||['new_user','verified','first_deposit','trader'].includes(badge.id)||!c.badgeCriteria[badge.id])throw new ApiError('Badge requires approved criteria or automatic server evidence',409);
    const e=(await tx.get(ref('orinProgramEvidence',cleanKey(input.evidenceId)))).data();if(!e||e.uid!==target||e.kind!=='badge'||e.badge!==badge.id||e.termsVersion!==c.termsVersion||e.revoked)throw new ApiError('Trusted badge evidence required',409);
    tx.update(member(target),{badges:[...new Set([...(m.badges??[]),badge.id])]});
   }else if(input.action==='referral'){
    const rr=ref('orinReferralRewards',target),r=(await tx.get(rr)).data();if(!r)throw new ApiError('Unknown referral');
    const parent=member(r.referrerId),p=(await tx.get(parent)).data()!;
    if(input.status==='qualified'&&r.status==='pending'){
     const [v,pv,e]=await Promise.all([tx.get(ref('orinVerifiedCustomers',target)),tx.get(ref('orinVerifiedCustomers',r.referrerId)),tx.get(ref('orinProgramEvidence',cleanKey(input.evidenceId)))]);
     if(!v.data()?.verified||v.data()?.revoked||!pv.data()?.verified||pv.data()?.revoked||v.data()!.customerKey===pv.data()!.customerKey||!e.exists||e.data()!.uid!==target||e.data()!.kind!=='referral_qualified'||e.data()!.revoked||e.data()!.termsVersion!==c.termsVersion)throw new ApiError('Verified distinct customers and eligibility evidence required',409);
     tx.update(rr,{status:'qualified',evidenceId:input.evidenceId,qualifiedAt:now});tx.update(member(target),{referralStatus:'qualified'});tx.update(parent,{qualifiedCount:(p.qualifiedCount??0)+1,pendingCents:(p.pendingCents??0)+(r.amountCents??8000)});
    }else if(input.status==='rejected'&&['pending','qualified'].includes(r.status)){
     if(typeof input.reason!=='string'||!input.reason.trim())throw new ApiError('Rejection reason required');tx.update(rr,{status:'rejected',reason:input.reason,updatedAt:now});tx.update(member(target),{referralStatus:'rejected'});if(r.status==='qualified')tx.update(parent,{qualifiedCount:p.qualifiedCount-1,pendingCents:p.pendingCents-(r.amountCents??8000)});
    }else if(input.status==='paid'&&r.status==='qualified'){
     const id=cleanKey(input.accountId),a=accountRef(r.referrerId,id),data=requireReal((await tx.get(a)).data(),r.referrerId),pv=(await tx.get(ref('orinVerifiedCustomers',r.referrerId))).data(),cv=(await tx.get(ref('orinVerifiedCustomers',target))).data(),e=(await tx.get(ref('orinProgramEvidence',r.evidenceId))).data();
     if(!pv?.verified||pv.revoked||!cv?.verified||cv.revoked||!e||e.revoked||e.termsVersion!==c.termsVersion)throw new ApiError('Eligibility changed; review again',409);
     if(!money(data.balanceCents+(r.amountCents??8000)))throw new ApiError('Invalid balance');tx.update(a,{balanceCents:data.balanceCents+(r.amountCents??8000)});tx.update(rr,{status:'paid',accountId:id,paidAt:now});tx.update(member(target),{referralStatus:'paid'});tx.update(parent,{paidCents:(p.paidCents??0)+(r.amountCents??8000),pendingCents:p.pendingCents-(r.amountCents??8000)});ledger(tx,'referral-'+target,r.referrerId,id,'referral_reward',r.amountCents??8000,now);
    }else throw new ApiError('Invalid reward transition',409);
   }else if(input.action==='activity_reward'){
    const period=cleanKey(input.periodId),revenue=(await tx.get(ref('orinEligibleRevenue',target+'_'+period))).data(),pay=ref('orinActivityPayments',target+'_'+period),previous=await tx.get(pay);
    if(previous.exists||!revenue||revenue.uid!==target||!revenue.finalized||!money(revenue.netRevenueCents)||!Number.isInteger(revenue.direct)||!Number.isInteger(revenue.activeTeam))throw new ApiError('Finalized eligible net revenue required',409);
    const version=revenue.configurationRevision?validConfig((await tx.get(ref('orinProgramConfigurationHistory',String(revenue.configurationRevision)))).data()??{}):c;if(version.termsVersion!==revenue.termsVersion)throw new ApiError('Historical terms mismatch',409);const level=[...version.levels].reverse().find(l=>revenue.direct>=l.direct&&revenue.activeTeam>=l.active);if(!level)throw new ApiError('No eligible team level',409);
    const cents=Math.min(level.capCents,Number(BigInt(revenue.netRevenueCents)*BigInt(level.bps)/BigInt(10000))),id=cleanKey(input.accountId),a=accountRef(target,id),data=requireReal((await tx.get(a)).data(),target);
    if(cents<=0||!money(data.balanceCents+cents))throw new ApiError('No payable activity reward',409);
    tx.update(a,{balanceCents:data.balanceCents+cents});tx.create(pay,{uid:target,periodId:period,netRevenueCents:revenue.netRevenueCents,cents,level:level.level,createdAt:now});tx.update(member(target),{activityRewardCents:(m.activityRewardCents??0)+cents});ledger(tx,'activity-'+target+'_'+period,target,id,'team_activity',cents,now);
   }else throw new ApiError('Invalid admin action');
  }
  tx.create(command,{fingerprint,action:input.action,createdAt:now});audit(tx,'program-'+command.id,u.id,'PROGRAM_'+input.action,input.uid??'configuration',{...input,requestId},now);
 });return adminPrograms(u);
}
export async function accountActivity(u:Identity,accountId:string){
 const id=cleanKey(accountId);requireReal((await accountRef(u.id,id).get()).data(),u.id);
 const rows=await db.collection('orinProgramLedger').where('uid','==',u.id).where('accountId','==',id).orderBy('createdAt','desc').limit(100).get();
 return {accountId:id,ledger:rows.docs.flatMap(row=>{const d=row.data();return d.entries.map((e:Data,i:number)=>({id:row.id+':'+i,journal_id:row.id,accountId:id,account:e.account,amount_cents:e.cents,kind:d.kind,effective_at:d.createdAt}))})};
}
