import 'server-only';
import {database,IntegrationError} from './integration.service';
import {PILOT_ROUND,type PilotRow} from '@/lib/live-pilot';
import {matchRegistryEvidence} from '@/lib/run-owner-evidence';
export async function researchRunEvidence(owner:string,key:string):Promise<void>{
 const db=database();
 const round=await db.from('nbc_pilot_rounds').select('id').eq('id',PILOT_ROUND).eq('owner_id',owner).maybeSingle();
 if(round.error||!round.data)throw new IntegrationError(403,'This run is not assigned to your account.');
 const [slot,operation]=await Promise.all([db.from('nbc_pilot_slots').select('config').eq('round_id',PILOT_ROUND).eq('key',key).maybeSingle(),db.from('nbc_pilot_operations').select('*').eq('round_id',PILOT_ROUND).eq('key',key).maybeSingle()]);
 if(slot.error||operation.error||!operation.data||operation.data.state!=='completed')throw new IntegrationError(409,'Finish discovery before registry research.');
 if(slot.data?.config.industry!=='chiropractor')throw new IntegrationError(409,'A matching owner registry is not yet connected for this industry and market.');
 const old=operation.data.result.ownerEvidence as Array<{checkedAt:string}>|undefined;
 if(old?.length&&Date.parse(old[0].checkedAt)>Date.now()-86400000)return;
 const params=new URLSearchParams({version:'2.1',enumeration_type:'NPI-2',address_purpose:'LOCATION',taxonomy_description:'Chiropractor',city:slot.data.config.city,state:slot.data.config.state,limit:'200'});
 let payload:{results?:unknown[];Errors?:unknown};
 try{const r=await fetch(`https://npiregistry.cms.hhs.gov/api/?${params}`,{cache:'no-store',redirect:'error',signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error();const raw=await r.text();if(raw.length>2000000)throw Error();payload=JSON.parse(raw);}catch{throw new IntegrationError(503,'The public registry could not be read. No identity claims were changed.');}
 if(payload.Errors||!Array.isArray(payload.results))throw new IntegrationError(503,'Registry response could not be verified.');
 const checkedAt=new Date().toISOString(),rows=operation.data.result.rows as PilotRow[];
 const result={...operation.data.result,ownerEvidence:rows.map(row=>matchRegistryEvidence(row,payload.results!,checkedAt)),registryTruncated:payload.results.length===200};
 const saved=await db.rpc('nbc_pilot_observe',{p_owner:owner,p_key:key,p_version:operation.data.version,p_state:operation.data.state,p_provider:operation.data.provider,p_result:result,p_reported:null});
 if(saved.error)throw new IntegrationError(409,'The run changed during research. Refresh before trying again.');
}
