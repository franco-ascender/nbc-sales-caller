import {isUsState} from './lead-engine-plan.ts';
import {excludeBeforeVerification,qualifiedRows} from './run-review.ts';
import type {PilotSlotView} from './live-pilot.ts';
export type CyclePhase='discover'|'filter'|'research'|'verify'|'deliver'|'done';
export type CycleStatus='running'|'paused'|'waiting_rate'|'needs_attention'|'completed';
export interface LeadCycle {key:string;name:string;industry:string;city:string;state:string;count:number;status:CycleStatus;phase:CyclePhase;message:string|null;started_at:string;phase_started_at:string;finished_at:string|null;events:Array<{phase:CyclePhase;at:string;message:string|null}>}
export interface CycleInput {requestId:string;name:string;industry:'roofing'|'chiropractor'|'medspa';city:string;state:string;count:number}
export const cycleKey=/^list-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function parseCycleInput(value:unknown):CycleInput {
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Enter the list details.');
 const b=value as Record<string,unknown>;
 if(Object.keys(b).some(k=>!['action','requestId','name','industry','city','state','count','confirmed'].includes(k))||b.action!=='create'||b.confirmed!==true||typeof b.requestId!=='string'||!uuid.test(b.requestId))throw Error('Confirm the displayed reservation before starting.');
 if(typeof b.name!=='string'||b.name.trim().length<2||b.name.length>80||/[\x00-\x1f]/.test(b.name))throw Error('Use a list name of 2–80 characters.');
 if(!['roofing','chiropractor','medspa'].includes(String(b.industry)))throw Error('Choose an available industry.');
 if(typeof b.city!=='string'||b.city.trim().length<2||b.city.length>60||!/^[A-Za-z .'-]+$/.test(b.city))throw Error('Enter a US city name.');
 if(typeof b.state!=='string'||!isUsState(b.state.toUpperCase()))throw Error('Enter a US state abbreviation, such as FL.');
 if(typeof b.count!=='number'||!Number.isInteger(b.count)||b.count<5||b.count>50)throw Error('This round supports 5–50 businesses per list.');
 return {requestId:b.requestId.toLowerCase(),name:b.name.trim(),industry:b.industry as CycleInput['industry'],city:b.city.trim(),state:b.state.toUpperCase(),count:b.count};
}
export function cycleCounts(slot: PilotSlotView|undefined) {
 const rows=slot?.result.rows??[], checks=slot?.result.phoneChecks??[];
 const eligible=[...new Set(rows.filter(r=>!excludeBeforeVerification(r)).map(r=>r.phone10!))];
 return {found:rows.length,excluded:rows.filter(r=>excludeBeforeVerification(r)).length,eligible:eligible.length,checked:checks.filter(c=>eligible.includes(c.phone10)&&c.state==='completed').length,remaining:eligible.filter(p=>!checks.some(c=>c.phone10===p)).length,qualified:qualifiedRows(slot?.result??{}).length};
}
export function cyclePresentation(run:LeadCycle,slot:PilotSlotView|undefined,now=Date.now()) {
 const counts=cycleCounts(slot), stages:CyclePhase[]=['discover','filter','research','verify','deliver','done'];
 const index=stages.indexOf(run.phase),elapsed=Math.max(0,Math.floor(((run.finished_at?Date.parse(run.finished_at):now)-Date.parse(run.started_at))/1000));
 const titles={discover:'Finding businesses',filter:'Filtering your results',research:'Gathering business evidence',verify:'Verifying phone numbers',deliver:'Preparing your list',done:'Your list is ready'};
 const percent=run.status==='completed'?100:run.phase==='verify'?55+Math.floor(35*counts.checked/Math.max(1,counts.eligible)):[8,30,45,55,95,100][index];
 let eta='Planning estimate · about 3–8 min';
 if(run.status==='completed')eta=`Finished · ${counts.qualified} phone-qualified contacts`;
 else if(run.status!=='running')eta='Estimate paused until the next step can continue';
 else if(run.phase==='verify'&&counts.checked>0){const perPhone=Math.max(2,Math.min(30,(now-Date.parse(run.phase_started_at))/1000/counts.checked));const seconds=counts.remaining*perPhone;eta=counts.remaining?`Estimated remaining · ${Math.max(1,Math.ceil(seconds*.7/60))}–${Math.max(1,Math.ceil(seconds*1.5/60))} min`:'Finishing saved checks…';}
 else if(run.phase==='deliver')eta='Final checks · usually under a minute';
 else if(elapsed>=480)eta='Taking longer than the initial estimate · checking for updates';
 else eta=`Planning estimate · about ${Math.max(1,Math.ceil((180-elapsed)/60))}–${Math.max(1,Math.ceil((480-elapsed)/60))} min left`;
 return {counts,percent,title:titles[run.phase],elapsed,eta,stages,index};
}
