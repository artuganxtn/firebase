import {db,ref,account,configRef,check,bootstrap,settings,configData,ApiError,audit,id,FieldValue,type Identity,type Data} from './store';
import {validatePreferences} from '../../lib/settings-engine';
import {DEFAULT_CONFIGURATION,TIMEFRAMES,CHART_TYPES,INDICATORS,parsePreferences} from '../../lib/preferences';
import {MARKET_SYMBOLS} from '../../lib/market-symbols';
const object=(v:unknown):v is Data=>!!v&&typeof v==='object'&&!Array.isArray(v);
function keys(v:Data,allowed:string[]){if(Object.keys(v).some(k=>!allowed.includes(k)))throw new ApiError('إعداد غير مسموح.')}
export async function saveSettings(u:Identity,input:Data,now=Date.now()){
 keys(input,['revision','preferences','profile','closeAccount']);await bootstrap(u,now);
 await db.runTransaction(async tx=>{await check(tx,u);const a=(await tx.get(account(u.id))).data()!,config=configData((await tx.get(configRef())).data());
  if(!Number.isSafeInteger(input.revision)||input.revision!==a.revision)throw new ApiError('تغيرت الإعدادات. أعد تحميل الصفحة.',409);
  const patch=input.preferences??{};if(!object(patch))throw new ApiError('إعدادات غير صالحة.');validatePreferences(patch,config.configuration);
  const preferences=parsePreferences({...a.preferences,...patch,notificationEvents:{...a.preferences.notificationEvents,...patch.notificationEvents}},config.configuration),profile={...a.profile};
  if(input.profile!==undefined){if(!object(input.profile))throw new ApiError('بيانات غير صالحة.');keys(input.profile,['displayName','phone','country']);for(const [key,value] of Object.entries(input.profile)){
   if(typeof value!=='string')throw new ApiError('بيانات غير صالحة.');const text=value.trim();
   if(key==='displayName'&&(!text||text.length>100)||key==='phone'&&text!==''&&!/^\+?[0-9 ()-]{6,24}$/.test(text)||key==='country'&&text!==''&&!/^[A-Z]{2}$/.test(text))throw new ApiError('تحقق من بيانات الحساب.');profile[key]=text;
  }}
  if(input.closeAccount!==undefined){if(input.closeAccount!==true)throw new ApiError('التأكيد مطلوب.');if(a.reservedCents!==0)throw new ApiError('أكمل العقود النشطة قبل طلب الإغلاق.',409);profile.closureStatus='requested'}
  tx.update(account(u.id),{preferences,profile,revision:a.revision+1,updated_at:now,name:profile.displayName});
  if(input.profile?.displayName)tx.update(ref('users',u.id),{displayName:profile.displayName,updatedAt:FieldValue.serverTimestamp()});
  audit(tx,id(),u.id,input.closeAccount?'ACCOUNT_CLOSURE_REQUESTED':'PREFERENCES_UPDATED',u.id,{revision:a.revision+1,fields:Object.keys(patch),profileFields:Object.keys(input.profile??{}),closureRequested:input.closeAccount===true},now);
 });return settings(u);
}
function list(value:unknown,allowed:readonly string[],required=false){if(!Array.isArray(value)||value.length>allowed.length||required&&!value.length||new Set(value).size!==value.length||value.some(v=>typeof v!=='string'||!allowed.includes(v)))throw new ApiError('قائمة إعدادات غير صالحة.')}
export async function saveConfiguration(u:Identity,input:Data,now=Date.now()){
 keys(input,['revision','configuration']);if(!object(input.configuration))throw new ApiError('إعدادات غير صالحة.');keys(input.configuration,Object.keys(DEFAULT_CONFIGURATION));
 return db.runTransaction(async tx=>{await check(tx,u,true);const previous=configData((await tx.get(configRef())).data());if(input.revision!==previous.configurationRevision)throw new ApiError('تغيرت إعدادات الإدارة. أعد التحميل.',409);
  const c={...previous.configuration,...input.configuration};list(c.enabledSymbols,MARKET_SYMBOLS.map(s=>s.pair),true);list(c.enabledTimeframes,TIMEFRAMES,true);list(c.enabledChartTypes,CHART_TYPES,true);list(c.allowedIndicators,INDICATORS);list(c.allowedDrawingTools,[]);
  if(!c.enabledSymbols.includes(c.defaultSymbol)||!c.enabledTimeframes.includes(c.defaultTimeframe)||!c.enabledChartTypes.includes(c.defaultChartType))throw new ApiError('القيم الافتراضية يجب أن تكون مفعّلة.');
  for(const k of ['volume','gridDefault','crosshairDefault','fullscreen','alerts','favorites'])if(typeof c[k as keyof typeof c]!=='boolean')throw new ApiError('قيمة غير صالحة.');if(c.alerts||!c.crosshairDefault)throw new ApiError('هذه الميزة غير مدعومة حاليًا.',409);
  const next={configuration:c,revision:previous.configurationRevision+1,updated_at:now};tx.set(configRef(),next);audit(tx,id(),u.id,'MARKET_CONFIGURATION_UPDATED','markets',{before:previous.configuration,after:c,revision:next.revision},now);return configData(next);
 });
}
