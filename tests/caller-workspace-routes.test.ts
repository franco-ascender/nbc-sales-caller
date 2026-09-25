import "./caller-test-loader.mjs";
import assert from "node:assert/strict";
import test from "node:test";
const workspace = await import("../src/app/api/workspace/session/route.ts");
const leads = await import("../src/app/api/caller/leads/route.ts");
const voices = await import("../src/app/api/caller/voices/route.ts");
const sessions = await import("../src/app/api/caller/sessions/route.ts");
const { ensureCallerDisclosure } = await import("../src/services/caller-voices.service.ts");
const { openingDisclosure } = await import("../src/lib/caller-disclosure.ts");
const ids={admin:"11111111-1111-4111-8111-111111111111",student:"22222222-2222-4222-8222-222222222222",lead:"33333333-3333-4333-8333-333333333333",job:"44444444-4444-4444-8444-444444444444"};
const req=(path:string,method="GET",body?:unknown,auth:string|null="admin")=>new Request(`https://fixture.test${path}`,{method,headers:{...(auth?{Authorization:`Bearer ${auth}`} : {}),...(body!==undefined?{"Content-Type":"application/json"}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{})});
test("shared identity and CRM/voice routes exercise real auth, service and SDK",async t=>{
 const original=globalThis.fetch;const names=["NEXT_PUBLIC_SUPABASE_URL","SUPABASE_SECRET_KEY","NBC_OPERATOR_EMAIL","ELEVENLABS_API_KEY","ELEVENLABS_AGENT_ID"],previous=names.map(name=>process.env[name]);["https://sales-fixture.supabase.co","fixture-secret","bootstrap@example.test","fixture-voice-key","fixture-agent"].forEach((value,i)=>process.env[names[i]]=value);
 let memberStatus="active",memberRole="admin",missingSchema=false,dbReads=0,providerWrites=0,designs=0,failDesign=false,currentVoice="voice-one",firstMessage="Old greeting",maxDuration=60;
 let job:Record<string,unknown>|null=null;let owned=true;let versionMatch=true;
 const row={id:ids.lead,name:"Demo lead",phone:"+12125550100",email:"",company:"Demo",source:"fixture",stage:"new",notes:"",created_at:"2026-09-14T00:00:00.000Z",updated_at:"2026-09-14T00:00:00.000Z"};
 globalThis.fetch=async(input,init)=>{
  const url=new URL(typeof input==="string"||input instanceof URL?input:input.url);const headers=new Headers(init?.headers ?? (input instanceof Request?input.headers:undefined));const method=init?.method||"GET",body=init?.body?JSON.parse(String(init.body)):{};
  if(url.pathname==="/auth/v1/user"){const token=headers.get("authorization")?.slice(7);if(token==="invalid")return Response.json({message:"invalid"},{status:401});return Response.json({id:token==="student"?ids.student:ids.admin,email:token==="bootstrap"?"bootstrap@example.test":"member@example.test",email_confirmed_at:token==="unconfirmed"?null:"2026-09-14T00:00:00Z"});}
  if(url.pathname==="/rest/v1/nbc_members"){if(missingSchema)return Response.json({code:"PGRST205",message:"missing"},{status:404});return Response.json([{id:url.searchParams.get("id")?.slice(3),display_name:"Demo Member",role:memberRole,status:memberStatus}]);}
  if(url.hostname==="api.elevenlabs.io"){
   if(method!=="GET")providerWrites++;
   if(url.pathname==="/v1/user/subscription")return Response.json({tier:"creator",can_use_instant_voice_cloning:true});
   if(url.pathname==="/v1/text-to-voice/design"){designs++;if(failDesign)return Response.json({secret:"provider-private"},{status:500});return Response.json({previews:[{generated_voice_id:"generated-one"}]});}
   if(url.pathname==="/v1/text-to-voice")return Response.json({voice_id:"voice-created"});
   if(url.pathname==="/v2/voices")return Response.json({voices:[{voice_id:"voice-one",name:"Demo Voice",preview_url:"javascript:alert(1)"},{voice_id:"voice-two",name:"Demo Voice 2"}],has_more:false});
   assert.equal(url.pathname,"/v1/convai/agents/fixture-agent");if(method==="PATCH"){assert.deepEqual(Object.keys(body),["conversation_config"]);if(body.conversation_config.tts)currentVoice=body.conversation_config.tts.voice_id;if(body.conversation_config.agent)firstMessage=body.conversation_config.agent.first_message;if(body.conversation_config.conversation)maxDuration=body.conversation_config.conversation.max_duration_seconds;}
   return Response.json({conversation_config:{tts:{voice_id:currentVoice},agent:{first_message:firstMessage},conversation:{max_duration_seconds:maxDuration}},platform_settings:{privacy:{record_voice:false}}});
  }
  assert.equal(url.hostname,"sales-fixture.supabase.co");dbReads++;
  if(url.pathname==="/rest/v1/caller_voice_jobs"){
   if(method==="POST"){if(job)return Response.json({code:"23505"},{status:409});job={...body};return new Response(null,{status:201});}
   assert.equal(url.searchParams.get("operator_id"),`eq.${ids.admin}`);
   if(method==="PATCH"){Object.assign(job!,body);return Response.json([{id:ids.job}]);}return Response.json(job?[job]:[]);
  }
  if(url.pathname==="/rest/v1/rpc/caller_import_leads"){assert.equal(body.p_operator,ids.student);assert.ok(!("operator_id" in body));return Response.json({imported:1,duplicates:0,replayed:false});}
  assert.ok(["/rest/v1/caller_leads","/rest/v1/call_sessions"].includes(url.pathname));
  assert.equal(url.searchParams.get("operator_id"),`eq.${memberRole==="student"?ids.student:ids.admin}`);
  if(url.pathname.endsWith("call_sessions"))return Response.json([]);
  if(method==="PATCH"){assert.equal(url.searchParams.get("updated_at"),`eq.${row.updated_at}`);return Response.json(owned&&versionMatch?[{...row,...body}]:[]);}
  return Response.json(owned?[row]:[]);
 };
 try{
  await t.test("anonymous and invalid/unconfirmed users rejected before protected reads",async()=>{for(const auth of [null,"invalid","unconfirmed"]){const before=dbReads;for(const response of [await workspace.GET(req("/api/workspace/session","GET",undefined,auth)),await leads.GET(req("/api/caller/leads","GET",undefined,auth)),await voices.POST(req("/api/caller/voices","POST",{},auth))])assert.equal(response.status,401);assert.equal(dbReads,before);}});
  await t.test("active student shares dashboard and Caller access but cannot manage voices",async()=>{memberRole="student";const identity=await workspace.GET(req("/api/workspace/session","GET",undefined,"student"));assert.equal(identity.status,200);assert.equal((await identity.json()).user.role,"student");assert.equal((await sessions.GET(req("/api/caller/sessions","GET",undefined,"student"))).status,200);assert.equal((await leads.GET(req("/api/caller/leads","GET",undefined,"student"))).status,200);for(const method of ["GET","POST","PATCH"] as const)assert.equal((await voices[method](req("/api/caller/voices",method,method==="GET"?undefined:{},"student"))).status,403);assert.equal(providerWrites,0);});
  await t.test("suspended bootstrap cannot evade membership; missing schema admits only configured bootstrap",async()=>{memberStatus="suspended";assert.equal((await workspace.GET(req("/api/workspace/session","GET",undefined,"bootstrap"))).status,403);memberStatus="active";missingSchema=true;assert.equal((await workspace.GET(req("/api/workspace/session","GET",undefined,"bootstrap"))).status,200);assert.equal((await workspace.GET(req("/api/workspace/session","GET",undefined,"student"))).status,403);missingSchema=false;});
  await t.test("CRM validates input, injects verified owner, prevents cross-owner and stale edits",async()=>{memberRole="student";const lead={name:"Demo",phone:"2125550100"};let response=await leads.POST(req("/api/caller/leads","POST",{requestId:ids.job,operator_id:ids.admin,leads:[lead]},"student"));assert.equal(response.status,200);for(const body of [null,{requestId:"bad",leads:[lead]},{requestId:ids.job,leads:[{...lead,phone:"bad"}]}])assert.equal((await leads.POST(req("/api/caller/leads","POST",body,"student"))).status,400);const patch={id:ids.lead,stage:"qualified",notes:"Demo note",updatedAt:row.updated_at};owned=false;assert.equal((await leads.PATCH(req("/api/caller/leads","PATCH",patch,"student"))).status,404);owned=true;versionMatch=false;assert.equal((await leads.PATCH(req("/api/caller/leads","PATCH",patch,"student"))).status,409);versionMatch=true;response=await leads.PATCH(req("/api/caller/leads","PATCH",patch,"student"));assert.equal(response.status,200);assert.equal(response.headers.get("cache-control"),"no-store");});
  await t.test("admin voice selection uses minimal PATCH; previews sanitized; malformed cursor rejected",async()=>{memberRole="admin";const list=await voices.GET(req("/api/caller/voices"));assert.equal(list.status,200);assert.equal((await list.json()).voices[0].previewUrl,null);assert.equal((await voices.GET(req("/api/caller/voices?cursor="))).status,400);assert.equal((await voices.PATCH(req("/api/caller/voices","PATCH",{voiceId:"voice-two"}))).status,200);assert.equal(currentVoice,"voice-two");});
  await t.test("creation reserves once, retries return saved result; ambiguous failures never regenerate",async()=>{const body={requestId:ids.job,name:"Demo original",description:"An original warm American voice",acceptServiceUsage:true};assert.equal((await voices.POST(req("/api/caller/voices","POST",body))).status,200);assert.equal((await voices.POST(req("/api/caller/voices","POST",body))).status,200);assert.equal(designs,1);job=null;failDesign=true;const failure=await voices.POST(req("/api/caller/voices","POST",body));assert.equal(failure.status,502);assert.ok(!(await failure.text()).includes("provider-private"));assert.equal((await voices.POST(req("/api/caller/voices","POST",body))).status,409);assert.equal(designs,2);});
  await t.test("opening policy and ten-minute limit are verified before authorization without enabling audio",async()=>{await ensureCallerDisclosure();assert.equal(firstMessage,openingDisclosure(false));assert.equal(maxDuration,600);const before=providerWrites;await ensureCallerDisclosure();assert.equal(providerWrites,before);});
 }finally{globalThis.fetch=original;names.forEach((name,i)=>{if(previous[i]===undefined)delete process.env[name];else process.env[name]=previous[i];});}
});
