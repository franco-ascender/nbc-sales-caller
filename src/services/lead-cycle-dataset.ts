import {apifyId,discoveryError} from '../lib/lead-engine-discovery.ts';
export async function readSearchPage(token:string,dataset:string,offset:number,maximum:number,request:typeof fetch=fetch){
 if(!apifyId(dataset)||!Number.isInteger(maximum)||maximum<1||maximum>5000||!Number.isInteger(offset)||offset<0||offset>maximum)throw discoveryError();
 const limit=Math.min(200,maximum-offset);
 const fields='title,city,state,countryCode,phone,phoneUnformatted,url,website,categoryName,categories,permanentlyClosed,temporarilyClosed,placeId';
 const r=await request(`https://api.apify.com/v2/datasets/${dataset}/items?${new URLSearchParams({format:'json',offset:String(offset),limit:String(limit),clean:'false',fields})}`,{headers:{Authorization:'Bearer '+token},cache:'no-store',redirect:'error',signal:AbortSignal.timeout(15000)});
 if(!r.ok||!r.body)throw discoveryError();
 const reader=r.body.getReader(),parts:Uint8Array[]=[];let size=0;
 try{for(;;){const p=await reader.read();if(p.done)break;size+=p.value.length;if(size>2*1024*1024){await reader.cancel();throw discoveryError();}parts.push(p.value);}}finally{reader.releaseLock();}
 const header=(key:string)=>{const v=r.headers.get('x-apify-pagination-'+key);if(v===null||!/^\d+$/.test(v))throw discoveryError();return Number(v);};
 const bytes=new Uint8Array(size);let at=0;for(const p of parts){bytes.set(p,at);at+=p.length;}
 const rows:unknown=JSON.parse(new TextDecoder().decode(bytes)),total=header('total');
 if(!Array.isArray(rows)||rows.length>limit||header('offset')!==offset||header('count')!==rows.length||offset+rows.length>total||(!rows.length&&offset<Math.min(total,maximum)))throw discoveryError();
 return {rows,total,nextOffset:offset+rows.length};
}
