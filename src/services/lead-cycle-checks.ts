import type {SupabaseClient} from '@supabase/supabase-js';
import type {PilotPhoneCheck} from '@/lib/live-pilot';
import {PILOT_ROUND} from '@/lib/live-pilot';
import {IntegrationError} from './integration.service';
export async function readPilotChecks(db:SupabaseClient):Promise<Array<PilotPhoneCheck&{reserved_cents:number}>>{
 const rows:Array<PilotPhoneCheck&{reserved_cents:number}>=[];
 for(let offset=0;;offset+=1000){const {data,error}=await db.from('nbc_pilot_phone_checks').select('phone10,state,verification,reserved_cents').eq('round_id',PILOT_ROUND).order('phone10').range(offset,offset+999);if(error)throw new IntegrationError(503,'Saved phone checks could not be read.');rows.push(...(data??[]));if(!data||data.length<1000)return rows;}
}
