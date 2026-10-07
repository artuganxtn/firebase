import {createHmac,timingSafeEqual} from 'node:crypto';
import {ApiError} from './store';
import type {PaymentCoin} from '../../lib/payments';
export type ProviderPayment=Record<string,unknown>;
export function canonical(value:unknown):unknown{
 if(Array.isArray(value))return value.map(canonical);
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([key,item])=>[key,canonical(item)]));
 return value;
}
export function validIpn(body:unknown,signature:string,secret:string){
 if(!secret||!body||typeof body!=='object'||Array.isArray(body)||!/^[a-fA-F0-9]{128}$/.test(signature))return false;
 const expected=createHmac('sha512',secret).update(JSON.stringify(canonical(body))).digest();
 return timingSafeEqual(expected,Buffer.from(signature,'hex'));
}
export function providerId(value:unknown){
 if(typeof value==='number'&&!Number.isSafeInteger(value))throw new ApiError('Invalid payment identifier',502);
 const result=String(value??'');if(!/^[0-9]{1,30}$/.test(result))throw new ApiError('Invalid payment identifier',502);return result;
}
/** Decimal comparison without binary-float rounding; reject missing, negative and excessive precision. */
export function units(value:unknown,decimals=18):bigint{
 const text=String(value??'');if(!/^\d{1,20}(\.\d{1,18})?$/.test(text))throw new ApiError('Invalid provider amount',502);
 const [whole,fraction='']=text.split('.');if(fraction.length>decimals&&/[1-9]/.test(fraction.slice(decimals)))throw new ApiError('Invalid amount precision',502);
 return BigInt(whole)*BigInt(10)**BigInt(decimals)+BigInt(fraction.slice(0,decimals).padEnd(decimals,'0'));
}
export class NowPayments {
 constructor(private apiKey:string,private callback:string,private requester:typeof fetch=fetch){}
 private async request(path:string,body?:unknown){
  if(!this.apiKey)throw new ApiError('خدمة الدفع بانتظار إعداد الخادم.',503);
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
  try{
   const response=await this.requester('https://api.nowpayments.io/v1'+path,{method:body?'POST':'GET',headers:{'x-api-key':this.apiKey,'Content-Type':'application/json',Accept:'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:controller.signal,redirect:'error'});
   if(!response.ok)throw new ApiError(response.status===400?'تعذر إنشاء الدفع؛ تحقق من العملة والحد الأدنى لدى المزود.':'تعذر الاتصال بمزود الدفع. تحقق من حالة الطلب قبل إعادة المحاولة.',response.status===400?422:503);
   if(!response.headers.get('content-type')?.includes('application/json'))throw new ApiError('استجابة مزود الدفع غير صالحة.',502);
   const result=await response.json();if(!result||Array.isArray(result)||typeof result!=='object')throw new ApiError('استجابة مزود الدفع غير صالحة.',502);
   return result as ProviderPayment;
  }finally{clearTimeout(timer)}
 }
 create(orderId:string,amountCents:number,coin:PaymentCoin){return this.request('/payment',{price_amount:amountCents/100,price_currency:'usd',pay_currency:coin,order_id:orderId,order_description:'ORIN account deposit',ipn_callback_url:this.callback,is_fixed_rate:false,is_fee_paid_by_user:false})}
 get(id:string){return this.request('/payment/'+providerId(id))}
}
