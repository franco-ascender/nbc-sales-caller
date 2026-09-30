import {MemberError} from './member-validation';
export function parseBillingStatement(raw:unknown){
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new MemberError(400,'Use a valid billing document.');
 const b=raw as Record<string,unknown>;
 const text=(key:string,max:number,required=true)=>{const v=b[key];if(typeof v!=='string'||v.length>max||(required&&!v.trim()))throw new MemberError(400,`Check ${key}.`);return v.trim();};
 const amount=(key:string)=>{const v=b[key];if(typeof v!=='string'||!/^\d{1,6}(\.\d{1,2})?$/.test(v))throw new MemberError(400,'Enter document amounts with up to two decimals.');return Math.round(Number(v)*1e6);};
 const provider=text('provider',80),reference=text('reference',160),issued_on=text('issued_on',10),currency=text('currency',3),kind=text('kind',20),evidence=text('evidence',500),note=text('note',2000,false);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(issued_on)||!Number.isFinite(Date.parse(issued_on))||new Date(issued_on).toISOString().slice(0,10)!==issued_on||!/^[A-Z]{3}$/.test(currency)||!['invoice','prepayment'].includes(kind))throw new MemberError(400,'Check the date, currency and document type.');
 const total_microusd=amount('total'),applied_microusd=amount('applied'),due_microusd=amount('due');
 if(applied_microusd+due_microusd!==total_microusd)throw new MemberError(400,'Applied balance plus amount due must equal the document total.');
 return {provider,reference,issued_on,currency,kind,evidence,note,total_microusd,applied_microusd,due_microusd};
}
