import 'server-only';
import {database} from './integration.service';
import {OnboardingError,validId,type IntakeRecord} from '../lib/client-onboarding.ts';
export const ONBOARDING_TABLE='nbc_client_onboardings';
export const ONBOARDING_SELECT='id,intake,state,revision,task_id,issue,created_at,updated_at,transport,automation_claimed_at,slack_channel_id,welcome_message_ts';
export function checked<T>(r:{data:T;error:{code?:string}|null}):T {
 if(r.error){if(r.error.code==='23505')throw new OnboardingError(409,'An onboarding entry already exists for this email or channel name. Open it from Recent onboarding.');throw new OnboardingError(503,'The onboarding record could not be saved or loaded. Refresh before continuing.');}return r.data;
}
export async function loadOnboarding(id:string):Promise<IntakeRecord>{
 const row=checked(await database().from(ONBOARDING_TABLE).select(ONBOARDING_SELECT).eq('id',validId(id)).maybeSingle());
 if(!row)throw new OnboardingError(404,'Onboarding not found.');return row as IntakeRecord;
}
export async function updateOnboarding(row:IntakeRecord,actor:string|null,patch:Record<string,unknown>):Promise<IntakeRecord>{
 const data=checked(await database().from(ONBOARDING_TABLE).update({...patch,revision:row.revision+1,...(actor?{updated_by:actor}:{}),updated_at:new Date().toISOString()}).eq('id',row.id).eq('revision',row.revision).eq('state',row.state).select(ONBOARDING_SELECT).maybeSingle());
 if(!data)throw new OnboardingError(409,'This onboarding changed. Reload the saved result.');return data as IntakeRecord;
}
