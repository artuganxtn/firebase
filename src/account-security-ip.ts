import {isIP} from 'node:net';
/**
 * Forwarded headers are accepted ONLY behind explicitly configured, non-bypassable
 * ingress. Trusting a count without a peer allowlist would let clients spoof IPs.
 * Deployment must block direct traffic and configure peer IPs + appended hop count.
 * https://docs.cloud.google.com/load-balancing/docs/https#x-forwarded-for_header
 */
export function resolveObservedIP(req:any,env:Record<string,string|undefined>=process.env){
 const raw=req.socket?.remoteAddress,peer=typeof raw==='string'&&isIP(raw)?raw:null;
 if(!peer)return {ip:null,transportIP:null,ipSource:'unavailable' as const};
 const peers=(env.ORIN_TRUSTED_PROXY_IPS??'').split(',').map(v=>v.trim()).filter(v=>isIP(v)),hops=Number(env.ORIN_TRUSTED_PROXY_HOPS);
 if(peers.includes(peer)&&Number.isSafeInteger(hops)&&hops>=1&&hops<=5){
  const header=req.get?.('x-forwarded-for'),parts=typeof header==='string'&&header.length<=1024?header.split(',').map(v=>v.trim()):[];
  if(parts.length>=hops&&parts.every(v=>isIP(v)))return {ip:parts[parts.length-hops],transportIP:peer,ipSource:'trusted-proxy' as const};
 }
 if(env.ORIN_DIRECT_CLIENT_IP==='true'&&!req.get?.('x-forwarded-for'))return {ip:peer,transportIP:peer,ipSource:'direct' as const};
 // Behind an unverified proxy the peer is transport metadata, never a claimed client IP.
 return {ip:null,transportIP:peer,ipSource:'unavailable' as const};
}
