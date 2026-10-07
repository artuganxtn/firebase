import {createCipheriv,createDecipheriv,createHash,createHmac,randomBytes,timingSafeEqual} from 'node:crypto';
export const opaque=()=>randomBytes(32).toString('base64url');
export const digest=(value:string)=>createHash('sha256').update(value).digest('hex');
export function equal(a:string,b:string){const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y)}
export function masterKey(value:string){if(!/^[A-Za-z0-9+/]{43}=$/.test(value)||Buffer.from(value,'base64').length!==32)throw new Error('ORIN_SECURITY_MASTER_KEY must be a 32-byte base64 secret');return Buffer.from(value,'base64')}
export function seal(secret:string,key:Buffer,uid:string){const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);cipher.setAAD(Buffer.from(`ORIN:TOTP:v1:${uid}`));return ['v1',iv.toString('base64url'),Buffer.concat([cipher.update(secret,'utf8'),cipher.final()]).toString('base64url'),cipher.getAuthTag().toString('base64url')].join('.')}
export function unseal(value:string,key:Buffer,uid:string){const [version,iv,data,tag]=value.split('.');if(version!=='v1')throw new Error('Unsupported secret version');const cipher=createDecipheriv('aes-256-gcm',key,Buffer.from(iv,'base64url'));cipher.setAAD(Buffer.from(`ORIN:TOTP:v1:${uid}`));cipher.setAuthTag(Buffer.from(tag,'base64url'));return Buffer.concat([cipher.update(Buffer.from(data,'base64url')),cipher.final()]).toString('utf8')}
const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export function base32(bytes:Buffer){let bits=0,value=0,out='';for(const byte of bytes){value=(value<<8)|byte;bits+=8;while(bits>=5){out+=alphabet[(value>>>(bits-5))&31];bits-=5}}if(bits)out+=alphabet[(value<<(5-bits))&31];return out}
export function decode32(value:string){let bits=0,n=0,bytes:number[]=[];for(const c of value){const x=alphabet.indexOf(c);if(x<0)throw new Error('Invalid base32');n=(n<<5)|x;bits+=5;if(bits>=8){bytes.push((n>>>(bits-8))&255);bits-=8}}return Buffer.from(bytes)}
export const newTotpSecret=()=>base32(randomBytes(20));
export function hotp(secret:string,counter:number,digits=6){const b=Buffer.alloc(8);b.writeBigUInt64BE(BigInt(counter));const h=createHmac('sha1',decode32(secret)).update(b).digest(),offset=h[h.length-1]&15;return String((h.readUInt32BE(offset)&0x7fffffff)%10**digits).padStart(digits,'0')}
export function verifyTotp(secret:string,code:string,now:number,lastStep=-1){if(!/^\d{6}$/.test(code))return null;const center=Math.floor(now/30000);for(const step of [center,center-1,center+1])if(step>lastStep&&equal(hotp(secret,step),code))return step;return null}
export function newRecoveryCodes(){return Array.from({length:10},()=>randomBytes(12).toString('hex').match(/.{1,6}/g)!.join('-'))}
export const recoveryHash=(code:string)=>digest('ORIN:recovery:'+code.trim().toLowerCase().replace(/[-\s]/g,''));
export const recoveryFormat=(code:unknown)=>typeof code==='string'&&/^[a-fA-F0-9\s-]{24,40}$/.test(code)&&code.replace(/[-\s]/g,'').length===24;
export const failureDelay=(failures:number)=>failures<3?0:Math.min(15*60_000,1000*2**Math.min(20,failures-3));
export function safeDevice(value:any){const clean=(v:any,n=100)=>typeof v==='string'?v.replace(/[\x00-\x1f<>]/g,'').slice(0,n):'';return {platform:['Android','iOS','Web'].includes(value?.platform)?value.platform:'Other',label:clean(value?.label)||'ORIN',manufacturer:clean(value?.manufacturer),model:clean(value?.model),osVersion:clean(value?.osVersion,40),appVersion:clean(value?.appVersion,30)}}
