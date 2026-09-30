// Registers an isolated Retell booking agent after NBC GHL connection is saved.
// Creates no calls, appointments or messages. Does NOT enable the connection.
// Usage: node --experimental-strip-types scripts/prepare-caller-booking.mjs <owner UUID>
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {parseEnv} from 'node:util';
import {createClient} from '@supabase/supabase-js';
import {retellConfigHash} from '../src/lib/retell-config.ts';
import {bookingTools} from '../src/lib/caller-booking-tools.ts';
const owner=process.argv[2];if(!/^[0-9a-f-]{36}$/.test(owner??''))throw Error('Specify the NBC owner UUID.');
const env=parseEnv(readFileSync('.env.local','utf8')),origin=env.CALLER_WEBHOOK_ORIGIN;
if(!origin)throw Error('Configure the public caller origin first.');
const base=JSON.parse(readFileSync('src/services/retell-scenario-config.ts','utf8').split('scenarioPhoneConfig:RetellConfig=')[1].trim().replace(/;$/,''));
if(Date.parse(base.quoteExpiresAt)<=Date.now())throw Error('Review the current phone quote before preparing booking.');
const db=createClient(env.NEXT_PUBLIC_SUPABASE_URL,env.SUPABASE_SECRET_KEY,{auth:{persistSession:false}}),c=await db.from('caller_booking_connections').select('config,verified_at,retell_config').eq('owner_id',owner).single();
if(c.error||!c.data?.config.calendarId)throw Error('Save and verify the NBC GHL booking connection first.');
if(c.data.config.enabled)throw Error('Pause booking before updating its phone tools.');
if(c.data.retell_config){console.log({alreadyPrepared:true,callsStarted:0});process.exit(0);}
const dir='artifacts/readiness/booking';mkdirSync(dir,{recursive:true,mode:0o700});const path=`${dir}/${owner}.json`,state=existsSync(path)?JSON.parse(readFileSync(path,'utf8')):{};
const save=()=>writeFileSync(path,JSON.stringify(state,null,2),{mode:0o600});
async function api(path,method='GET',body){const r=await fetch('https://api.retellai.com'+path,{method,headers:{Authorization:'Bearer '+env.RETELL_API_KEY,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(30000),redirect:'error'});if(!r.ok)throw Error(`Retell HTTP ${r.status}`);const t=await r.text();return t?JSON.parse(t):{};}
// An interrupted create remains marked uncertain; never automatically create a duplicate agent.
if(!state.llmId){if(state.creatingLlm)throw Error('Reconcile the previous Retell LLM create before continuing.');state.creatingLlm=true;save();const l=await api('/create-retell-llm','POST',{model:'gpt-4.1-mini',model_temperature:.2,model_high_priority:false,general_prompt:'You are NBC Sales’ AI assistant on an authorized call. Be honest about AI and recording. Respect opt-out and interruptions. Follow the supplied scenario and booking instructions. Only the connected tools can confirm appointments and notification status. Never invent availability, meeting links, delivery or tool results.\n{{nbc_scenario}}',begin_message:"Hi, I'm NBC Sales' AI assistant. This call is being recorded and transcribed. Is now a good time?",general_tools:[{type:'end_call',name:'end_call',description:'End on request, voicemail or when finished.'},...bookingTools(origin)]});state.llmId=l.llm_id;save();}
if(!state.agentId){if(state.creatingAgent)throw Error('Reconcile the previous Retell agent create before continuing.');state.creatingAgent=true;save();const a=await api('/create-agent','POST',{agent_name:'NBC · Booking caller',response_engine:{type:'retell-llm',llm_id:state.llmId},voice_id:base.voiceId,voice_model:'eleven_flash_v2',voice_speed:.9,language:'en-US',responsiveness:1,interruption_sensitivity:.8,enable_backchannel:false,max_call_duration_ms:600000,end_call_after_silence_ms:60000,ring_duration_ms:25000,post_call_analysis_model:'gpt-4.1-mini',data_storage_setting:'everything',opt_in_signed_url:true,contact_memory_config:{enable_read:false,enable_update:false}});state.agentId=a.agent_id;save();}
let a=await api('/get-agent/'+state.agentId);if(!a.is_published)await api('/publish-agent-version/'+state.agentId,'POST',{version:a.version});a=await api('/get-agent/'+state.agentId+'?version=0');const l=await api('/get-retell-llm/'+state.llmId+'?version='+a.response_engine.version);
if(!a.is_published||a.voice_id!==base.voiceId||l.model!=='gpt-4.1-mini'||bookingTools(origin).some(t=>!l.general_tools?.some(x=>x.name===t.name&&x.url===t.url)))throw Error('Booking agent verification failed.');
const config={...base,agentId:state.agentId,llmId:state.llmId,version:a.version,llmVersion:a.response_engine.version,agentHash:retellConfigHash(a),llmHash:retellConfigHash(l)};
const saved=await db.from('caller_booking_connections').update({retell_config:config}).eq('owner_id',owner).eq('config->>enabled','false').select('owner_id');if(saved.error||saved.data?.length!==1)throw Error('Could not save the prepared agent.');console.log({prepared:true,enabled:false,callsStarted:0,appointmentsCreated:0,messagesSent:0});
