import {requireMember} from '@/services/member-workspace';
import {accountError} from '@/services/account-usage';
import {processPayment} from '@/services/credit-payments';
export async function POST(request:Request){try{return Response.json(await processPayment(request));}catch(e){return accountError(e);}}
