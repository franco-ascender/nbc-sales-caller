import 'server-only';
import {database,IntegrationError} from './integration.service';
import {ensureAdmin} from './account-usage';
import type {Member} from '@/lib/member-types';
import {operationCosts,type CostOperation,type CostSlot,type CostCheck} from '@/lib/operation-costs';
export async function readOperationCosts(actor:Member){
 ensureAdmin(actor);const db=database();let truncated=false;
 async function all<T>(table:string,columns:string,order:string):Promise<T[]>{const rows:T[]=[];for(let offset=0;offset<10000;offset+=500){const r=await db.from(table).select(columns).order(order).range(offset,offset+499);if(r.error)throw new IntegrationError(503,'Saved operation costs could not be read.');rows.push(...(r.data??[]) as unknown as T[]);if((r.data?.length??0)<500)return rows;}truncated=true;return rows;}
 const [operations,slots,checks]=await Promise.all([
  all<CostOperation>('nbc_pilot_operations','round_id,key,state,reserved_cents,reported_microusd,result,created_at,updated_at','key'),
  all<CostSlot>('nbc_pilot_slots','round_id,key,kind,title,config','key'),
  all<CostCheck>('nbc_pilot_phone_checks','round_id,slot_key,phone10,state,reserved_cents,rate_microusd,verification','phone10'),
 ]);
 return{...operationCosts(operations,slots,checks),truncated};
}
