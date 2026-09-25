import {createHmac,timingSafeEqual} from 'node:crypto';
export function validStripeSignature(body:string,header:string|null,secret:string,now=Date.now()):boolean {
 if(!secret||!header)return false;const parts=header.split(',').map(x=>x.split('=')),times=parts.filter(([k])=>k==='t');if(times.length!==1||!/^\d+$/.test(times[0][1]??''))return false;const timestamp=Number(times[0][1]);if(!Number.isSafeInteger(timestamp)||Math.abs(now/1000-timestamp)>300)return false;
 const expected=createHmac('sha256',secret).update(`${timestamp}.${body}`).digest();return parts.some(([k,v])=>k==='v1'&&/^[a-f0-9]{64}$/.test(v??'')&&timingSafeEqual(expected,Buffer.from(v,'hex')));
}
