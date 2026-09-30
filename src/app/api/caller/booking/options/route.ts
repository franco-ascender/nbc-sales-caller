import {requireWorkspaceAdmin} from '@/services/workspace-auth';
import {apiError,IntegrationError} from '@/services/integration.service';
import {readCallerJson} from '@/services/caller-crm.service';
import {getBookingConnection,decryptBookingToken} from '@/services/caller-booking-store';
import {CallerGhl} from '@/services/caller-ghl.service';
import {bookingId} from '@/lib/caller-booking';
import {isRecord} from '@/lib/integration-validation';
export async function POST(request:Request){try{const user=await requireWorkspaceAdmin(request),body=await readCallerJson(request,8192);if(!isRecord(body))throw new IntegrationError(400,'Enter your GHL connection.');let locationId;try{locationId=bookingId(body.locationId);}catch{throw new IntegrationError(400,'Enter your GHL Location ID.');}const old=await getBookingConnection(user.id),token=typeof body.token==='string'&&body.token.trim()?body.token.trim():old?.config.locationId===locationId?decryptBookingToken(user.id,old.token_ciphertext):'';if(!token||token.length>4096)throw new IntegrationError(400,'Enter the GHL private integration token.');return Response.json(await new CallerGhl(token,locationId).options(),{headers:{'Cache-Control':'no-store'}});}catch(e){return apiError(e);}}
