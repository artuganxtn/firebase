import {randomBytes} from 'node:crypto';
import {FieldValue} from 'firebase-admin/firestore';
import {db,ref,check,type Identity} from './store';
import {controlAccess} from './control-auth';
import {programSummary} from './programs';
import type {ReferralSummary} from '../../lib/referrals';
export async function referralSummary(u:Identity):Promise<ReferralSummary>{
 const identity=ref('orinReferralIdentities',u.id),generated='ORIN-'+randomBytes(6).toString('hex').toUpperCase();
 await db.runTransaction(async tx=>{await check(tx,u);await controlAccess(u,false,tx);const [old,member]=await Promise.all([tx.get(identity),tx.get(ref('orinProgramMembers',u.id))]);if(old.exists)return;const code=member.data()?.code??generated,claim=ref('orinReferralCodes',code),taken=await tx.get(claim);if(taken.exists&&taken.data()?.uid!==u.id)throw new Error('Referral identity conflict');tx.create(identity,{code,createdAt:FieldValue.serverTimestamp()});if(!taken.exists)tx.create(claim,{uid:u.id})});
 const [summary,record]=await Promise.all([programSummary(u),identity.get()]);const m=summary.member;
 return {code:record.data()!.code,invited:m?.direct??null,successful:m?.qualified??null,totalRewardCents:m?m.paidCents+m.pendingCents:null,rewards:summary.rewards,referrals:summary.tree.filter(r=>r.depth===1).map(r=>({id:r.id,status:r.status})),terms:summary.config.referralCriteria,summaryState:'ready',rewardsActive:summary.config.enabled};
}
