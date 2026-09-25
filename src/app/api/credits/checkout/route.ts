import {requireMember} from '@/services/member-workspace';
import {accountError} from '@/services/account-usage';
import {startCheckout} from '@/services/credit-payments';
import {readJson} from '@/services/integration.service';
export async function POST(request:Request){try{const actor=await requireMember(request);return Response.json(await startCheckout(actor,await readJson(request)),{headers:{'Cache-Control':'no-store'}});}catch(e){return accountError(e);}}
