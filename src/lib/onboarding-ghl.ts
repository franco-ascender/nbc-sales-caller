import {emptyIntake,OnboardingError,parseIntake,type Intake} from './client-onboarding.ts';

export interface GhlReceipt {
 id:string; opportunity_id:string; contact_id:string; intake:Intake;
 issues:string[]; received_at:string; mode:'capture';
}
export function object(value:unknown):Record<string,unknown> {
 if(!value||typeof value!=='object'||Array.isArray(value))throw new OnboardingError(400,'Expected a JSON object.');
 return value as Record<string,unknown>;
}
export function ghlId(value:unknown):string {
 if(typeof value!=='string'||!/^[A-Za-z0-9_-]{8,80}$/.test(value))throw new OnboardingError(400,'Map nbc_opportunity_id to the triggering opportunity ID.');
 return value;
}
export function opportunityFromWebhook(input:unknown):string {
 const body=object(input);
 const custom=body.customData===undefined?{}:object(body.customData);
 // GHL standard payload has an ambiguous root `id`; require the explicit mapping.
 const a=body.nbc_opportunity_id,b=custom.nbc_opportunity_id;
 if(a!==undefined&&b!==undefined&&a!==b)throw new OnboardingError(400,'Conflicting opportunity IDs.');
 return ghlId(a??b);
}
const text=(v:unknown)=>typeof v==='string'?v.trim():'';
export function contactIntake(input:unknown,recordingField:string):{intake:Intake;issues:string[]} {
 const contact=object(input),intake=emptyIntake(),issues:string[]=[];
 intake.name=text(contact.name)||[text(contact.firstName),text(contact.lastName)].filter(Boolean).join(' ');
 intake.company=text(contact.companyName)||intake.name;
 intake.email=text(contact.email).toLowerCase();
 if(Array.isArray(contact.customFields)){
  const field=contact.customFields.find(f=>f&&typeof f==='object'&&(f as Record<string,unknown>).id===recordingField) as Record<string,unknown>|undefined;
  intake.recording=text(field?.value);
 }
 for(const key of ['name','email','company'] as const)if(!intake[key])issues.push(`Missing ${key}.`);
 try{parseIntake(intake);}catch(e){if(e instanceof OnboardingError)issues.push(e.message);else throw e;}
 // Retain only the small, explicitly mapped fields; never store the full contact/webhook.
 for(const key of Object.keys(intake) as (keyof Intake)[])intake[key]=intake[key].slice(0,key==='recording'?1500:200);
 return {intake,issues:[...new Set(issues)]};
}
