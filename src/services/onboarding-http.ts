import {IntegrationError} from './integration.service';
import {OnboardingError} from '../lib/client-onboarding.ts';
export function onboardingResponse(data:unknown,status=200){return Response.json(data,{status,headers:{'Cache-Control':'no-store'}});}
export function onboardingFailure(error:unknown){const known=error instanceof OnboardingError||error instanceof IntegrationError;return onboardingResponse({error:known?error.message:'Onboarding could not be completed. Reload the saved record before trying again.'},known?error.status:500);}
