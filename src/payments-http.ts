import {onRequest} from 'firebase-functions/v2/https';
import {defineSecret} from 'firebase-functions/params';
import {identity,ApiError} from './store';
import {NowPayments} from './nowpayments';
import {paymentService} from './payments';
import {PAYMENT_COINS} from '../../lib/payments';
const apiKey=defineSecret('ORIN_NOWPAYMENTS_API_KEY'),ipnSecret=defineSecret('ORIN_NOWPAYMENTS_IPN_SECRET');
const defaultOrigins=['https://orin-99951.web.app','https://orin-99951.firebaseapp.com'];
function getAllowedOrigins(){
 const list=[...defaultOrigins];
 if(process.env.ALLOWED_ORIGINS)list.push(...process.env.ALLOWED_ORIGINS.split(',').map(s=>s.trim()));
 return list;
}
export async function paymentsHandle(req:any,res:any){
 res.set('Cache-Control','private, no-store');res.set('X-Content-Type-Options','nosniff');
 try{
  const origin=req.get('origin'),allowed=getAllowedOrigins();
  if(origin){if(!allowed.includes(origin)&&!(process.env.FUNCTIONS_EMULATOR==='true'&&/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)))throw new ApiError('مصدر الطلب غير مسموح.',403);res.set('Access-Control-Allow-Origin',origin);res.set('Vary','Origin');res.set('Access-Control-Allow-Headers','Authorization, Content-Type, X-Orin-Session');res.set('Access-Control-Allow-Methods','GET, POST, OPTIONS')}
  if(req.method==='OPTIONS'){res.status(204).send('');return}
  const getApiKey=()=>{try{return apiKey.value()||process.env.ORIN_NOWPAYMENTS_API_KEY||''}catch{return process.env.ORIN_NOWPAYMENTS_API_KEY||''}};
  const getIpnSecret=()=>{try{return ipnSecret.value()||process.env.ORIN_NOWPAYMENTS_IPN_SECRET||''}catch{return process.env.ORIN_NOWPAYMENTS_IPN_SECRET||''}};
  const callback=process.env.ORIN_PAYMENTS_CALLBACK_URL||'https://europe-west1-orin-99951.cloudfunctions.net/orinPayments/api/payments/nowpayments/ipn';
  const keyVal=getApiKey(),secretVal=getIpnSecret();
  const service=paymentService(new NowPayments(keyVal,callback),secretVal);
  if(req.method==='POST'&&(!req.is('application/json')||!req.body||Array.isArray(req.body)||typeof req.body!=='object'||Buffer.byteLength(JSON.stringify(req.body))>16000))throw new ApiError('بيانات طلب غير صالحة.');
  if(req.path==='/api/payments/nowpayments/ipn'&&req.method==='POST'){res.json(await service.webhook(req.body,req.get('x-nowpayments-sig')??''));return}
  const enabled=process.env.ORIN_DEPOSITS_ENABLED==='true'&&!!keyVal&&!!secretVal;
  if(req.method==='GET'&&req.path==='/api/payments/readiness'){res.json({provider:'ORIN Pay',deposits:enabled,withdrawals:false,coins:PAYMENT_COINS,...(!enabled?{reason:'activation_pending'}:{})});return}
  const user=await identity(req.get('authorization'),req.get('x-orin-session'));
  if(req.method==='POST'&&req.path==='/api/payments/deposits'){
   if(!enabled)throw new ApiError('الإيداع بانتظار إكمال إعداد الخدمة.',503);
   res.json(await service.create(user,req.body));return;
  }
  if(req.method==='GET'&&req.path==='/api/payments/deposits'){res.json({items:await service.list(user,String(req.query.accountId??''))});return}
  const match=req.path.match(/^\/api\/payments\/deposits\/(np-[a-f0-9]{64})$/);
  if(req.method==='GET'&&match){res.json(await service.get(user,match[1],req.query.refresh==='true'));return}
  throw new ApiError('المسار غير متاح.',404);
 }catch(error){const status=error instanceof ApiError?error.status:503;if(!(error instanceof ApiError))console.error('ORIN payments request failed',{path:req.path,type:error instanceof Error?error.name:'unknown'});res.status(status).json({error:error instanceof ApiError?error.message:'تعذر الاتصال بخدمة الدفع. راجع حالة الطلب ثم أعد المحاولة.'})}
}
export const orinPayments=onRequest({region:'europe-west1',memory:'256MiB',timeoutSeconds:60,minInstances:0,maxInstances:2,concurrency:20,cors:false,secrets:[apiKey,ipnSecret]},paymentsHandle);
