import {requireMember} from '@/services/member-workspace';
import {accountError} from '@/services/account-usage';
import {creditPackages} from '@/services/credit-payments';
export async function GET(request:Request){try{await requireMember(request);return Response.json(await creditPackages(),{headers:{'Cache-Control':'private, no-store'}});}catch(e){return accountError(e);}}
