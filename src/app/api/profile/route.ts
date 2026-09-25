import {requireMember} from '@/services/member-workspace';
import {readProfile,saveProfile,accountError} from '@/services/account-usage';
import {readJson} from '@/services/integration.service';
export async function GET(request:Request){try{return Response.json(await readProfile(await requireMember(request)),{headers:{'Cache-Control':'private, no-store'}});}catch(e){return accountError(e);}}
export async function PATCH(request:Request){try{const actor=await requireMember(request);return Response.json(await saveProfile(actor,await readJson(request)),{headers:{'Cache-Control':'no-store'}});}catch(e){return accountError(e);}}
