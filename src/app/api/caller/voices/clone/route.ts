import {apiError,IntegrationError} from '@/services/integration.service';import {requireWorkspaceAdmin} from '@/services/workspace-auth';import {cloneOwnVoice} from '@/services/caller-clone.service';import {validSessionId} from '@/lib/caller-validation';import {audioFileType,audioTypes,MAX_SAMPLE_BYTES} from '@/lib/caller-audio';
export const maxDuration=60;
export async function POST(request:Request):Promise<Response>{try{
 const user=await requireWorkspaceAdmin(request);if(!request.headers.get('content-type')?.startsWith('multipart/form-data;'))throw new IntegrationError(415,'Upload a supported audio sample.');
 const declared=Number(request.headers.get('content-length'));if(Number.isFinite(declared)&&declared>MAX_SAMPLE_BYTES+65536)throw new IntegrationError(413,'Use an audio sample up to 3 MB.');
 const reader=request.body?.getReader();if(!reader)throw new IntegrationError(400,'An audio sample is required.');let size=0;const chunks:Uint8Array[]=[];
 try{while(true){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>MAX_SAMPLE_BYTES+65536){await reader.cancel();throw new IntegrationError(413,'Use an audio sample up to 3 MB.');}chunks.push(part.value);}}finally{reader.releaseLock();}
 let form:FormData;try{form=await new Response(Buffer.concat(chunks),{headers:{'Content-Type':request.headers.get('content-type')!}}).formData();}catch{throw new IntegrationError(400,'The audio upload could not be read.');}
 const id=form.get('requestId'),name=form.get('name'),sample=form.get('sample');
 if(!validSessionId(id)||typeof name!=='string'||!name.trim()||name.length>80||form.get('acceptServiceUsage')!=='true')throw new IntegrationError(400,'Name the voice and authorize its creation.');
 const mode=form.get('voicePermission'),ownerName=form.get('voiceOwnerName');let permission:string|undefined;
 if(mode==='authorized'){if(typeof ownerName!=='string'||!ownerName.trim()||ownerName.length>120||/[\x00-\x1f\x7f]/.test(ownerName)||form.get('voiceOwnerConsent')!=='true')throw new IntegrationError(400,'Name the voice owner and confirm their permission to create and use this voice copy.');permission=`Voice owner: ${ownerName.trim()}; permission confirmed by NBC administrator.`;}
 else if((mode!==null&&mode!=='own')||form.get('ownVoiceConsent')!=='true')throw new IntegrationError(400,'Confirm that this is your voice or that its owner has authorized you.');
 if(!(sample instanceof File)||sample.size<1024||sample.size>MAX_SAMPLE_BYTES||!audioTypes.includes(sample.type.split(';')[0]))throw new IntegrationError(400,'Use a clear MP3, WAV, WebM, OGG or M4A sample up to 3 MB.');
 if(!audioFileType(new Uint8Array(await sample.slice(0,16).arrayBuffer())))throw new IntegrationError(400,'The file does not contain a supported audio format.');
 return Response.json(await cloneOwnVoice(user.id,id,name.trim(),sample,permission),{headers:{'Cache-Control':'no-store'}});
}catch(error){return apiError(error);}}
