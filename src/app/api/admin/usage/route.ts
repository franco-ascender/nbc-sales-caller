import {requireMember} from '@/services/member-workspace';
import {readUsage,accountError} from '@/services/account-usage';
export async function GET(request:Request){try{return Response.json(await readUsage(await requireMember(request),request),{headers:{'Cache-Control':'private, no-store'}});}catch(e){return accountError(e);}}
