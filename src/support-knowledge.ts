import {db,ref} from './store';
import {SUPPORT_KNOWLEDGE,SUPPORT_KNOWLEDGE_VERSION,type SupportKnowledgeDocument} from '../../lib/support-knowledge';
import {parseSupportAIConfig,SUPPORT_AI_DEFAULTS} from '../../lib/support-ai-control';
export async function currentSupportSettings(){const snapshot=await ref('orinSupportConfiguration','current').get();if(!snapshot.exists)return {...SUPPORT_AI_DEFAULTS,enabled:process.env.ORIN_SUPPORT_AI_ENABLED==='true',provider:process.env.ORIN_SUPPORT_AI_PROVIDER==='gemini'?'gemini':'openai-compatible',model:process.env.ORIN_SUPPORT_AI_MODEL??(process.env.ORIN_SUPPORT_AI_PROVIDER==='gemini'?'gemini-3.5-flash-lite':SUPPORT_AI_DEFAULTS.model)};const raw=snapshot.data()!;return parseSupportAIConfig(Object.fromEntries(Object.keys(SUPPORT_AI_DEFAULTS).map(k=>[k,raw[k]])));}
export async function reviewedSupportKnowledge(query:string):Promise<{version:string;documents:SupportKnowledgeDocument[]}>{
 const rows=await db.collection('orinSupportKnowledge').where('status','==','published').limit(50).get();
 const words=query.toLocaleLowerCase().match(/[\p{L}\p{N}]{3,}/gu)?.slice(0,50)??[];
 const documents=rows.docs.filter(d=>{const v=d.data();return v.reviewed===true&&typeof v.title==='string'&&v.title.length<=120&&typeof v.content==='string'&&v.content.length<=4000&&/^[a-z0-9_-]{1,80}$/.test(d.id)}).map(d=>{const v=d.data(),score=words.reduce((n,w)=>n+Number((v.title+' '+v.content).toLocaleLowerCase().includes(w)),0);return {id:'kb-'+d.id,title:v.title,content:v.content.slice(0,1800),revision:Number.isSafeInteger(v.revision)?v.revision:0,score}}).sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id)).slice(0,6);
 return {version:SUPPORT_KNOWLEDGE_VERSION+documents.map(d=>'|'+d.id+':'+d.revision).join(''),documents:[...SUPPORT_KNOWLEDGE,...documents.map(({id,title,content})=>({id,title,content}))]};
}
