import { apifyId, discoveryError } from '../lib/lead-engine-discovery.ts';
export interface DatasetPage { offset:number; total:number; rows:unknown[] }
export function createLeadDatasetReader(token:string,request:typeof fetch=fetch) {
  return async (datasetId:string,offset:number,maxResults:number):Promise<DatasetPage> => {
    if(!token.trim()||!apifyId(datasetId)||!Number.isSafeInteger(offset)||offset<0||offset>300||!Number.isSafeInteger(maxResults)||maxResults<1||maxResults>300) throw discoveryError();
    try {
      const response=await request(`https://api.apify.com/v2/datasets/${datasetId}/items?format=json&offset=${offset}&limit=50&desc=false&clean=false`,{
        headers:{Authorization:`Bearer ${token}`},redirect:'error',cache:'no-store',signal:AbortSignal.timeout(15000)});
      if(!response.ok||!response.body) {await response.body?.cancel();throw discoveryError();}
      const reader=response.body.getReader();const chunks:Uint8Array[]=[];let length=0;
      try {for(;;){const part=await reader.read();if(part.done)break;length+=part.value.length;if(length>2097152){await reader.cancel();throw discoveryError();}chunks.push(part.value);}} finally {reader.releaseLock();}
      const bytes=new Uint8Array(length);let cursor=0;for(const part of chunks){bytes.set(part,cursor);cursor+=part.length;}
      const rows:unknown=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
      const header=(name:string):number=>{const v=response.headers.get(`x-apify-pagination-${name}`);if(v===null||!/^\d+$/.test(v))throw discoveryError();return Number(v);};
      const total=header('total'),count=header('count');
      if(header('offset')!==offset||!Array.isArray(rows)||rows.length!==count||rows.length>50||total>maxResults||offset+count>total||(count===0&&offset<total))throw discoveryError();
      return {offset,total,rows};
    } catch {throw discoveryError();}
  };
}
