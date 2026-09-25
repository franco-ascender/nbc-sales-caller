import './caller-test-loader.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePilotAction } from '../src/lib/live-pilot.ts';
const routes=await import('../src/app/api/pilot/route.ts');
const owner='11111111-1111-4111-8111-111111111111';
const other='22222222-2222-4222-8222-222222222222';
const round='2026-09-25-first-live-tests';
test('pilot actions reject unconfirmed dispatch, arbitrary destinations, amounts and unknown slots',()=>{
  for(const b of [{action:'start',key:'caller-2'},{action:'start',key:'caller-3',confirmed:true},{action:'start',key:'caller-2',confirmed:true,destination:'+12025550102'},{action:'start',key:'roofing-miami',confirmed:true,budget:5000},{action:'feedback',key:'caller-2',feedback:'a'.repeat(3001)}])assert.throws(()=>parsePilotAction(b));
  assert.equal(parsePilotAction({action:'start',key:'caller-2',confirmed:true}).action,'start');
});
test('actual portal routes enforce ownership, reserve before dispatch, avoid retries and stop the recorded call (HTTP fixtures only)',async t=>{
  const original=globalThis.fetch;const saved={...process.env};
  Object.assign(process.env,{NEXT_PUBLIC_SUPABASE_URL:'https://pilot-fixture.supabase.co',SUPABASE_SECRET_KEY:'fixture',ELEVENLABS_API_KEY:'fixture',TWILIO_ACCOUNT_SID:'AC'+'a'.repeat(32),TWILIO_AUTH_TOKEN:'fixture',APIFY_API_TOKEN:'fixture'});
  const settings={agentId:'agent_fixture',from:'+12025550101',destination:'+12025550102'};
  const slots=[{round_id:round,key:'caller-2',kind:'phone',title:'Your live Nalify call',allocation_cents:250,reserve_cents:250,config:{}}];
  type Op={key:string;state:string;reserved_cents:number;version:number;provider:Record<string,unknown>;result:Record<string,unknown>;reported_microusd:number|null};
  let operations:Op[]=[],creates=0,registers=0,stops=0,ambiguous=false,invalidConfig=false,callStatus='in-progress';
  const json=(x:unknown,status=200)=>Response.json(x,{status});
  const req=(body?:object,token:string|null='owner')=>new Request('https://fixture.test/api/pilot',{method:body?'POST':'GET',headers:{...(token?{Authorization:'Bearer '+token}:{}),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
  globalThis.fetch=async(input,init)=>{
    const u=new URL(String(input)),headers=new Headers(init?.headers),method=init?.method??'GET';
    if(u.hostname==='pilot-fixture.supabase.co'){
      if(u.pathname==='/auth/v1/user')return json({id:headers.get('authorization')==='Bearer other'?other:owner,email:'fixture@example.test',email_confirmed_at:'2026-09-25T00:00:00Z'});
      if(u.pathname==='/rest/v1/nbc_members')return json([{id:owner,display_name:'Fixture',role:'admin',status:'active'}]);
      if(u.pathname==='/rest/v1/nbc_pilot_rounds')return json(u.searchParams.get('owner_id')==='eq.'+owner?[{id:round,owner_id:owner,cap_cents:2500,paused:false,settings}]:[]);
      if(u.pathname==='/rest/v1/nbc_pilot_slots')return json(slots);
      if(u.pathname==='/rest/v1/nbc_pilot_operations')return json(operations);
      const b=JSON.parse(String(init?.body));assert.equal(b.p_owner,owner);
      if(u.pathname.endsWith('/nbc_pilot_reserve')){
        const found=operations.find(o=>o.key===b.p_key);if(found)return json({acquired:false,operation:found});
        const o={key:b.p_key,state:'dispatching',reserved_cents:250,version:0,provider:{},result:{},reported_microusd:null};operations.push(o);return json({acquired:true,operation:o});
      }
      if(u.pathname.endsWith('/nbc_pilot_observe')){
        const o=operations.find(o=>o.key===b.p_key)!;
        if(o.version!==b.p_version)return json({code:'P0001',message:'pilot_stale'},400);
        Object.assign(o,{state:b.p_state,version:o.version+1,provider:b.p_provider,result:b.p_result,reported_microusd:b.p_reported??o.reported_microusd});return json(o);
      }
    }
    if(u.hostname==='api.elevenlabs.io'){
      if(u.pathname.endsWith('/agents/agent_fixture'))return json({conversation_config:{agent:{first_message:'Nalify',prompt:{llm:'gpt-4.1-mini',max_tokens:140,prompt:'Nalify',tools:[{type:'system',name:'end_call'}]}},conversation:{max_duration_seconds:invalidConfig?7200:600},tts:{agent_output_audio_format:'ulaw_8000'},asr:{user_input_audio_format:'ulaw_8000'}},platform_settings:{auth:{enable_auth:true},call_limits:{agent_concurrency_limit:1,daily_limit:2,bursting_enabled:false}}});
      if(u.pathname==='/v1/user/subscription')return json({status:'active',character_limit:300000,character_count:100,can_extend_character_limit:false});
      if(u.pathname==='/v1/convai/twilio/register-call'){assert.equal(operations.length,1);registers++;return new Response('<Response><Connect><Stream url="wss://api.elevenlabs.io/voice" /></Connect></Response>');}
      if(u.pathname==='/v1/convai/conversations')return json({conversations:[]});
    }
    if(u.hostname==='pricing.twilio.com')return json({outbound_prefix_prices:[{destination_prefixes:['1'],current_price:'.014'}]});
    if(u.hostname==='api.twilio.com'){
      if(u.pathname.endsWith('/IncomingPhoneNumbers.json'))return json({incoming_phone_numbers:[{phone_number:settings.from,capabilities:{voice:true}}]});
      if(u.pathname.endsWith('/Balance.json'))return json({balance:'10',currency:'USD'});
      if(u.pathname.endsWith('/Calls.json')&&method==='POST'){
        assert.equal(operations[0].provider.phase,'dispatching');creates++;const form=new URLSearchParams(String(init?.body));assert.equal(form.get('To'),settings.destination);assert.equal(form.get('TimeLimit'),'600');assert.equal(form.get('Record'),'false');
        if(ambiguous)throw Error('lost network response');return json({sid:'CA'+'b'.repeat(32),status:'queued'});
      }
      if(u.pathname.endsWith('/Calls/CA'+'b'.repeat(32)+'.json')){
        if(method==='POST'){stops++;callStatus='completed';}
        return json({sid:'CA'+'b'.repeat(32),status:callStatus,duration:'21',price:'-.014',price_unit:'USD',to:settings.destination,from:settings.from});
      }
    }
    throw Error('Unexpected fixture request: '+method+' '+u.hostname+u.pathname);
  };
  try{
    await t.test('anonymous, another admin and invalid payload cannot dispatch',async()=>{
      assert.equal((await routes.GET(req(undefined,null))).status,401);
      assert.equal((await routes.GET(req(undefined,'other'))).status,403);
      assert.equal((await routes.POST(req({action:'start',key:'caller-2'}))).status,400);assert.equal(creates,0);
      const view=await(await routes.GET(req())).json();assert.equal(view.destinationLast4,'0102');assert.ok(!JSON.stringify(view).includes('agent_fixture'));assert.ok(!JSON.stringify(view).includes(settings.destination));
    });
    await t.test('read-only connection check and configuration rejection never reserve or dispatch',async()=>{
      assert.equal((await routes.POST(req({action:'check',key:'caller-2'}))).status,200);assert.equal(registers,0);assert.equal(operations.length,0);
      invalidConfig=true;assert.equal((await routes.POST(req({action:'start',key:'caller-2',confirmed:true}))).status,503);assert.equal(operations.length,0);invalidConfig=false;
    });
    await t.test('concurrent start requests dispatch only once; refresh is read-only and stop targets that call',async()=>{
      const responses=await Promise.all([routes.POST(req({action:'start',key:'caller-2',confirmed:true})),routes.POST(req({action:'start',key:'caller-2',confirmed:true}))]);
      assert.ok(responses.every(r=>r.status===200));assert.equal(creates,1);assert.equal(registers,1);
      assert.equal((await routes.POST(req({action:'sync',key:'caller-2'}))).status,200);assert.equal(creates,1);
      assert.equal((await routes.POST(req({action:'stop',key:'caller-2'}))).status,200);assert.equal(stops,1);assert.equal(operations[0].state,'completed');
    });
    await t.test('ambiguous dispatch retains the reservation and repeating Start never calls twice',async()=>{
      operations=[];ambiguous=true;assert.equal((await routes.POST(req({action:'start',key:'caller-2',confirmed:true}))).status,503);
      assert.equal(operations[0].state,'uncertain');const count=creates;
      assert.equal((await routes.POST(req({action:'start',key:'caller-2',confirmed:true}))).status,200);assert.equal(creates,count);
    });
  }finally{globalThis.fetch=original;for(const key of Object.keys(process.env))if(!(key in saved))delete process.env[key];Object.assign(process.env,saved);}
});
