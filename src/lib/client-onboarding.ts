export class OnboardingError extends Error {
  readonly status: number;
  constructor(status: number, message: string) { super(message); this.status=status; }
}
export interface Intake {
  company: string; name: string; email: string; partnerName: string; partnerEmail: string; recording: string; transcript: string;
}
export type IntakeState = 'draft'|'starting'|'queued'|'existing'|'uncertain'|'needs_review';
export interface IntakeRecord { id: string; intake: Intake; state: IntakeState; revision: number; task_id: string|null; issue: string|null; created_at: string; updated_at: string }
export const emptyIntake = (): Intake => ({company:'',name:'',email:'',partnerName:'',partnerEmail:'',recording:'',transcript:''});
export const LIST_ID = '901417783941';
export const SPACE_ID = '90145865057';
export const FIELDS = {
 email:{id:'ebef69b4-0e31-4b97-9dbc-3ed4a154cc0b',name:'Client Email',type:'email'},
 name:{id:'3f7d4180-261f-41bc-89fa-61f8e5367369',name:'Partner 1 Name',type:'short_text'},
 partnerName:{id:'9b7cd8a0-c779-42f9-af0d-8b53e8a36dc4',name:'Partner 2 Name',type:'short_text'},
 partnerEmail:{id:'d510dc53-d85f-4421-96a8-d6395f9804b7',name:'Partner 2 Email',type:'email'},
 recording:{id:'7ea4090b-8204-4daa-93f4-953dfbdf991c',name:'Fathom Recording Link',type:'url'},
 transcript:{id:'9f3bf090-39e6-4f23-b49c-080cf55ad0e2',name:'Google Doc Transcript Link',type:'url'},
} as const;
export function parseIntake(input: unknown): Intake {
 if(!input||typeof input!=='object'||Array.isArray(input))throw new OnboardingError(400,'Enter the client details.');
 const raw=input as Record<string,unknown>; const result=emptyIntake();
 for(const key of Object.keys(result) as (keyof Intake)[]){const v=raw[key]??'';if(typeof v!=='string'||v.length>(key==='recording'||key==='transcript'?1500:200)||/[\x00-\x1f\x7f]/.test(v))throw new OnboardingError(400,`Check ${key}.`);result[key]=v.trim();}
 if(!result.company||!result.name||!result.email)throw new OnboardingError(400,'Company, primary contact name and email are required.');
 for(const k of ['email','partnerEmail'] as const){result[k]=result[k].toLowerCase();if(result[k]&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result[k]))throw new OnboardingError(400,'Enter a valid email address.');}
 if(Boolean(result.partnerName)!==Boolean(result.partnerEmail))throw new OnboardingError(400,'Add both the second partner’s name and email, or leave both empty.');
 if(result.partnerEmail===result.email)throw new OnboardingError(400,'Use a different email for the second partner.');
 for(const k of ['recording','transcript'] as const){if(!result[k])continue;try{const u=new URL(result[k]);if(u.protocol!=='https:'||u.username||u.password||!(k==='recording'?['fathom.video','app.fathom.video'].includes(u.hostname):u.hostname==='docs.google.com'))throw Error();}catch{throw new OnboardingError(400,k==='recording'?'Use an HTTPS Fathom recording link.':'Use an HTTPS Google Docs transcript link.');}}
 if(channelName(result.company).length>80||!/[a-z0-9]/i.test(result.company)||/[^\p{L}\p{N} .&'’()_-]/u.test(result.company))throw new OnboardingError(400,'Use a shorter company name with letters, numbers, spaces or basic punctuation.');
 return result;
}
export function validId(value: unknown): string {if(typeof value!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value))throw new OnboardingError(400,'Invalid onboarding ID.');return value;}
export function revision(value:unknown):number{if(!Number.isSafeInteger(value)||Number(value)<1)throw new OnboardingError(400,'Refresh this onboarding before saving.');return Number(value);}
export const channelName=(company:string)=>'elite-'+company.toLowerCase().replace(/ /g,'-');
export const marker=(id:string)=>`NBC onboarding reference: ${validId(id)}`;
export function taskPayload(intake:Intake,id:string){return {name:intake.company,description:marker(id),status:'pending ',custom_item_id:0,check_required_custom_fields:true,custom_fields:Object.entries(FIELDS).filter(([key])=>intake[key as keyof Intake]).map(([key,f])=>({id:f.id,value:intake[key as keyof Intake]}))};}
export const taskLink=(id:string)=>`https://app.clickup.com/t/${encodeURIComponent(id)}`;
