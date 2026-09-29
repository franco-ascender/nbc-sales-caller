import {requireMember} from '@/services/member-workspace';
import {accountError} from '@/services/account-usage';
import {readOperationCosts} from '@/services/operation-costs.service';
export async function GET(request:Request){try{return Response.json(await readOperationCosts(await requireMember(request)),{headers:{'Cache-Control':'private, no-store'}});}catch(error){return accountError(error);}}
