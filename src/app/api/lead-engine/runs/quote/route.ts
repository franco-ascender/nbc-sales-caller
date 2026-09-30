import {requireWorkspaceAdmin} from '@/services/workspace-auth';
import {readJson,apiError,IntegrationError} from '@/services/integration.service';
import {parseCycleInput} from '@/lib/lead-cycle';
import {quoteSearch} from '@/services/lead-cycle-quote.service';
export async function POST(request:Request){try{const user=await requireWorkspaceAdmin(request);const body=await readJson(request);let input;try{input=parseCycleInput(body);}catch(e){throw new IntegrationError(400,e instanceof Error?e.message:'Check list details.');}return Response.json(await quoteSearch(user.id,input),{headers:{'Cache-Control':'no-store'}});}catch(e){return apiError(e);}}
