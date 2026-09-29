import {after} from 'next/server';
import {requireCallerUser} from '@/services/workspace-auth';
import {apiError,IntegrationError} from '@/services/integration.service';
import {readCallerJson} from '@/services/caller-crm.service';
import {phoneArchive,recordingLink,saveCallNote,archivePending} from '@/services/caller-archive.service';
export const runtime='nodejs';export const maxDuration=60;
const valid=(key:unknown):key is string=>typeof key==='string'&&/^(web-[0-9a-f-]{36}|dial-[0-9a-f-]{36}|caller-[12])$/.test(key);
export async function GET(request:Request){try{const owner=await requireCallerUser(request),u=new URL(request.url),key=u.searchParams.get('recording');if(key&&!valid(key))throw new IntegrationError(400,'Choose a saved call.');const result=key?await recordingLink(owner,key):await phoneArchive(owner);if(!key&&'calls' in result)after(()=>archivePending(owner,result.calls));return Response.json(result,{headers:{'Cache-Control':'no-store'}});}catch(e){return apiError(e);}}
export async function PATCH(request:Request){try{const owner=await requireCallerUser(request),b=await readCallerJson(request,16384) as Record<string,unknown>;if(!b||typeof b!=='object'||!valid(b.key)||typeof b.note!=='string'||b.note.length>3000||!Number.isSafeInteger(b.version)||Number(b.version)<0)throw new IntegrationError(400,'Use a valid note of at most 3,000 characters.');return Response.json(await saveCallNote(owner,b.key,b.note,Number(b.version)),{headers:{'Cache-Control':'no-store'}});}catch(e){return apiError(e);}}
