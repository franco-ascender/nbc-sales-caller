import 'server-only';import {createHash} from 'node:crypto';
import {database,IntegrationError} from './integration.service';import {ElevenActionError,elevenWrite} from './elevenlabs.service';import {voiceCapabilities} from './caller-voices.service';
export async function cloneOwnVoice(owner:string,id:string,name:string,sample:File,permission="Own voice sample, confirmed by account owner."):Promise<{voiceId:string;needsVerification:boolean;replayed:boolean}>{
 const hash=createHash('sha256').update(Buffer.from(await sample.arrayBuffer())).digest('hex'),db=database();
 const existing=await db.from('caller_voice_jobs').select('operator_id,name,description,kind,sample_hash,status,voice_id,needs_verification').eq('id',id).eq('operator_id',owner).maybeSingle();
 if(existing.error)throw new IntegrationError(503,'Voice creation storage is unavailable.');
 if(existing.data){const job=existing.data;if(job.kind!=='clone'||job.name!==name||job.sample_hash!==hash||(permission!=='Own voice sample, confirmed by account owner.'&&job.description!==permission)||(job.description?.startsWith('Voice owner:')&&job.description!==permission))throw new IntegrationError(409,'Use the original recording and name for this request.');if(job.status==='completed'&&job.voice_id)return{voiceId:job.voice_id,needsVerification:job.needs_verification,replayed:true};throw new IntegrationError(409,'This request already ran or needs review. It will not create another clone.');}
 if(!(await voiceCapabilities()).cloneAllowed)throw new IntegrationError(403,'Your connected plan does not include instant voice cloning. You can record and download a sample now; an administrator must enable a supported plan before creating the voice.');
 const reservation=await db.from('caller_voice_jobs').insert({id,operator_id:owner,name,description:permission,kind:'clone',sample_hash:hash,status:'preparing'});
 if(reservation.error)throw new IntegrationError(reservation.error.code==='23505'?409:503,'This voice request could not be reserved. Check its status before retrying.');
 try{
  const form=new FormData();form.set('name',name);form.set('description',permission);form.set('remove_background_noise','false');form.append('files',sample,'own-voice.'+(sample.name.split('.').pop()||'webm'));
  const data=await elevenWrite('/v1/voices/add','POST',form) as {voice_id?:unknown;requires_verification?:unknown};
  if(typeof data.voice_id!=='string'||!/^[A-Za-z0-9_-]{1,150}$/.test(data.voice_id))throw new Error('Incomplete confirmation');
  const needsVerification=data.requires_verification===true;
  const saved=await db.from('caller_voice_jobs').update({status:'completed',voice_id:data.voice_id,needs_verification:needsVerification}).eq('id',id).eq('operator_id',owner).eq('status','preparing').select('id').maybeSingle();if(saved.error||!saved.data)throw new Error('Save not confirmed');
  return{voiceId:data.voice_id,needsVerification,replayed:false};
 }catch(error){await db.from('caller_voice_jobs').update({status:error instanceof ElevenActionError&&error.definite?'failed':'uncertain',failure_code:error instanceof ElevenActionError?error.code:'unconfirmed'}).eq('id',id).eq('operator_id',owner).eq('status','preparing');if(error instanceof ElevenActionError&&error.definite)throw error;throw new IntegrationError(502,'The clone was not fully confirmed. Review available voices before starting another request. This reference will not generate twice.');}
}
