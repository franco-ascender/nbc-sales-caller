import {requireWorkspaceAdmin} from '@/services/workspace-auth';
import {database,apiError,IntegrationError} from '@/services/integration.service';
import {readCallerJson} from '@/services/caller-crm.service';
import {getBookingConnection,decryptBookingToken,encryptBookingToken} from '@/services/caller-booking-store';
import {parseBookingConfig,emptyBookingConfig} from '@/lib/caller-booking';
import {CallerGhl} from '@/services/caller-ghl.service';
import {preflightRetell} from '@/services/retell-phone.service';
import {isRecord} from '@/lib/integration-validation';
export async function GET(request:Request){try{const user=await requireWorkspaceAdmin(request),c=await getBookingConnection(user.id);const rows=await database().from('caller_bookings').select('id,operation_key,state,receipt,created_at,caller_booking_steps(kind,state,provider_id,reason,cost_microusd)').eq('owner_id',user.id).order('created_at',{ascending:false}).limit(20);if(rows.error)throw new IntegrationError(503,'Booking history could not load.');return Response.json({config:c?.config??emptyBookingConfig(),connected:Boolean(c),toolsReady:Boolean(c?.retell_config),verifiedAt:c?.verified_at??null,bookings:rows.data??[]},{headers:{'Cache-Control':'no-store'}});}catch(e){return apiError(e);}}
export async function PUT(request:Request){try{
 const user=await requireWorkspaceAdmin(request),body=await readCallerJson(request,16384);if(!isRecord(body))throw new IntegrationError(400,'Use valid booking settings.');
 let config;try{config=parseBookingConfig(body.config);}catch(e){throw new IntegrationError(400,e instanceof Error?e.message:'Invalid settings.');}
 const old=await getBookingConnection(user.id);let token=typeof body.token==='string'?body.token.trim():'';
 if(token.length>4096)throw new IntegrationError(400,'Invalid integration token.');
 if(!token&&old&&old.config.locationId===config.locationId)token=decryptBookingToken(user.id,old.token_ciphertext);
 if(!token)throw new IntegrationError(400,'Connect the private integration token for this GHL location.');
 await new CallerGhl(token,config.locationId).validate(config);
 if(config.enabled){if(!old?.retell_config)throw new IntegrationError(409,'Save the connection first. Phone booking tools must be registered before enabling.');await preflightRetell(old.retell_config);}
 const saved=await database().from('caller_booking_connections').upsert({owner_id:user.id,config,token_ciphertext:encryptBookingToken(user.id,token),verified_at:new Date().toISOString(),updated_at:new Date().toISOString()},{onConflict:'owner_id'});if(saved.error)throw new IntegrationError(503,'Booking settings could not be saved.');
 return Response.json({saved:true,enabled:config.enabled},{headers:{'Cache-Control':'no-store'}});
 }catch(e){return apiError(e);}}
export async function PATCH(request:Request){try{const user=await requireWorkspaceAdmin(request),old=await getBookingConnection(user.id);if(old){const r=await database().from('caller_booking_connections').update({config:{...old.config,enabled:false},updated_at:new Date().toISOString()}).eq('owner_id',user.id);if(r.error)throw new IntegrationError(503,'Booking could not be paused.');}return Response.json({paused:true});}catch(e){return apiError(e);}}
