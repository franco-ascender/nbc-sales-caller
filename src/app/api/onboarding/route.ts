import {onboardingResponse,onboardingFailure} from '@/services/onboarding-http';
import {onboardingAdmin,listOnboardings,saveOnboarding} from '@/services/client-onboarding';
import {ClickUpOnboarding} from '@/services/onboarding-clickup';
import {readJson} from '@/services/integration.service';
import {OnboardingError} from '@/lib/client-onboarding';
export const dynamic='force-dynamic';
export const maxDuration=60;
export async function GET(request:Request){try{await onboardingAdmin(request);const records=await listOnboardings();let connected=false,connectionIssue='';try{await new ClickUpOnboarding().verify();connected=true;}catch(e){connectionIssue=e instanceof OnboardingError?e.message:'ClickUp connection could not be verified.';}return onboardingResponse({records,connected,connectionIssue});}catch(e){return onboardingFailure(e);}}
export async function POST(request:Request){try{const actor=await onboardingAdmin(request);return onboardingResponse({record:await saveOnboarding(actor.id,await readJson(request))});}catch(e){return onboardingFailure(e);}}
