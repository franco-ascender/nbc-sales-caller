import './caller-test-loader.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {emptyBookingConfig,parseBookingConfig,parseBookingRequest,calendarInvite,blockedChannel,safeMeetingUrl} from '../src/lib/caller-booking.ts';
import {bookingTools} from '../src/lib/caller-booking-tools.ts';
const {CallerGhl}=await import('../src/services/caller-ghl.service.ts');
import type {BookingCall} from '../src/services/caller-booking-store.ts';
const {encryptBookingToken,decryptBookingToken,inviteSignature,validInviteSignature}=await import('../src/services/caller-booking-store.ts');
const {bookMeeting,completeBookingSteps}=await import('../src/services/caller-booking.service.ts');
const {POST:toolRoute}=await import('../src/app/api/caller/booking/tools/route.ts');
const {GET:configRoute}=await import('../src/app/api/caller/booking/config/route.ts');
import {parsePhoneTrial} from '../src/lib/caller-phone-trial.ts';
const owner='11111111-1111-4111-8111-111111111111';
const config={...emptyBookingConfig(),locationId:'location',calendarId:'calendar',pipelineId:'pipeline',stageId:'booked',tags:['meeting booked'],emailFrom:'meetings@example.test',smsFrom:'+13055550100',enabled:true};
const start=new Date(Date.now()+86400000).toISOString(),end=new Date(Date.parse(start)+1800000).toISOString();
const request={timezone:'America/New_York',startTime:start,name:'Test Person',email:'test@example.test',confirmed:true,smsConsent:true};

test('booking validates confirmed contact/time/channel settings and does not fabricate meeting links',()=>{
 assert.deepEqual(parseBookingConfig(config),config);
 assert.throws(()=>parseBookingConfig({...config,timezone:'Not/AZone'}));
 assert.throws(()=>parseBookingConfig({...config,smsFrom:'123'}));
 assert.throws(()=>parseBookingRequest({...request,confirmed:false}));
 assert.throws(()=>parseBookingRequest({...request,startTime:'2026-10-01T10:00:00'}));
 assert.throws(()=>parseBookingRequest({...request,startTime:new Date(0).toISOString()}));
 assert.throws(()=>parseBookingRequest({...request,email:'a\r\nBcc:evil@test.com'}));
 assert.equal(blockedChannel({dndSettings:{SMS:{status:'active'}}},'SMS'),true);
 assert.equal(blockedChannel({dnd:true},'Email'),true);
 assert.equal(safeMeetingUrl('javascript:alert(1)'),undefined);
 assert.equal(safeMeetingUrl('https://zoom.us/j/fixture'),'https://zoom.us/j/fixture');
 const base={requestId:'00000000-0000-4000-8000-000000000000',phone:'+13055550124',confirmed:true};
 assert.throws(()=>parsePhoneTrial({...base,booking:true}),/saved NBC/);
 assert.equal(parsePhoneTrial({...base,booking:true,scenarioId:owner}).booking,true);
 const tools=bookingTools('https://portal.example.test');assert.equal(tools.length,3);assert.ok(tools.every(t=>t.max_retry===0&&!('phone' in t.parameters.properties)));
});

test('encrypted credentials are owner-bound; calendar attachments escape controls and expire',()=>{
 const old=process.env.CALLER_BOOKING_ENCRYPTION_KEY;process.env.CALLER_BOOKING_ENCRYPTION_KEY=Buffer.alloc(32,7).toString('base64');
 try{const encrypted=encryptBookingToken(owner,'private-token');assert.ok(!encrypted.includes('private-token'));assert.equal(decryptBookingToken(owner,encrypted),'private-token');assert.throws(()=>decryptBookingToken('another-owner',encrypted));const expires=String(Date.now()+60000),sig=inviteSignature(owner,expires);assert.equal(validInviteSignature(owner,expires,sig),true);assert.equal(validInviteSignature(owner,'0',sig),false);assert.equal(validInviteSignature('other',expires,sig),false);
 const ics=calendarInvite({id:owner,title:'NBC;\nATTENDEE:evil',start,end,organizer:'meetings@example.test',email:'test@example.test',createdAt:start});assert.ok(ics.includes('SUMMARY:NBC\\;\\nATTENDEE:evil'));assert.equal(ics.split('\r\n').filter(l=>l.startsWith('ATTENDEE')).length,1);assert.ok(ics.includes('METHOD:REQUEST'));assert.ok(ics.split('\r\n').every(l=>Buffer.byteLength(l)<=75));
 }finally{if(old===undefined)delete process.env.CALLER_BOOKING_ENCRYPTION_KEY;else process.env.CALLER_BOOKING_ENCRYPTION_KEY=old;}
});

test('booking and direct invitation lifecycle is durable and duplicate-safe, using fake HTTP only',async()=>{
 const names=['NEXT_PUBLIC_SUPABASE_URL','SUPABASE_SECRET_KEY','CALLER_BOOKING_ENCRYPTION_KEY','CALLER_WEBHOOK_ORIGIN','RETELL_API_KEY'],prior=names.map(k=>process.env[k]);
 const values=['https://booking-fixture.supabase.co','test-service',Buffer.alloc(32,7).toString('base64'),'https://portal.example.test','test-retell'];names.forEach((k,i)=>process.env[k]=values[i]);
 const original=fetch;type Row=Record<string,unknown>;const rows:Row[]=[],steps:Row[]=[],calls:BookingCall[]=[];let appointmentCreates=0,emailSends=0,smsSends=0,tagWrites=0,opportunityWrites=0,free=true,smsTimeout=false,contactDnd=false,appointmentTimeout=false;
 const bind=(key:string):BookingCall=>{const c={owner_id:owner,operation_key:key,phone:'+13055550124',config,token_ciphertext:encryptBookingToken(owner,'test-ghl')};calls.push(c);return c;};
 const matches=(r:Row,u:URL)=>[...u.searchParams].every(([k,v])=>!v.startsWith('eq.')||String(r[k])===v.slice(3));
 const one=(data:unknown,init?:RequestInit)=>String(new Headers(init?.headers).get('accept')).includes('application/vnd.pgrst.object+json')?Array.isArray(data)?data[0]??null:data:data;
 globalThis.fetch=async(input,init)=>{
  const u=new URL(String(input)),method=init?.method??'GET',body=init?.body?JSON.parse(String(init.body)):null;
  if(u.hostname==='booking-fixture.supabase.co'){
   const name=u.pathname.split('/').at(-1);let list:Row[];
   if(name==='caller_booking_connections')return Response.json(one([{owner_id:owner,config}],init));
   if(name==='caller_booking_calls')return Response.json(one(calls.filter(c=>matches(c as unknown as Row,u)),init));
   if(name==='nbc_pilot_operations')return Response.json([]);
   if(name==='caller_bookings')list=rows;else if(name==='caller_booking_steps')list=steps;else throw Error('Unexpected DB endpoint '+name);
   if(method==='POST'){
    const unique=name==='caller_bookings'?list.some(r=>r.operation_key===body.operation_key):list.some(r=>r.booking_id===body.booking_id&&r.kind===body.kind);
    if(unique)return Response.json({code:'23505',message:'duplicate'},{status:409});
    list.push({created_at:new Date().toISOString(),receipt:{},contact_id:null,appointment_id:null,...body});return new Response(null,{status:201});
   }
   const found=list.filter(r=>matches(r,u));if(method==='PATCH')found.forEach(r=>Object.assign(r,body));return Response.json(one(found,init));
  }
  if(u.hostname==='services.leadconnectorhq.com'){
   assert.equal(new Headers(init?.headers).get('Version'),'v3');
   if(u.pathname.includes('free-slots'))return Response.json({'2030-01-01':{slots:free?[start]:[]}});
   if(u.pathname==='/contacts/upsert'){assert.deepEqual(body,{locationId:'location',phone:'+13055550124'});return Response.json({contact:{id:'contact'}});}
   if(u.pathname==='/contacts/contact'&&method==='GET')return Response.json({contact:{id:'contact',locationId:'location',phone:'+13055550124',email:'test@example.test',dnd:contactDnd}});
   if(u.pathname==='/contacts/contact'&&method==='PUT')return Response.json({contact:{id:'contact'}});
   if(u.pathname==='/calendars/events/appointments'&&method==='POST'){appointmentCreates++;assert.equal(body.toNotify,false);assert.equal(body.ignoreFreeSlotValidation,false);assert.equal(body.ignoreDateRange,false);if(appointmentTimeout)throw Error('lost response');return Response.json({id:'appointment'});}
   if(u.pathname==='/calendars/events/appointments/appointment')return Response.json({event:{id:'appointment',locationId:'location',calendarId:'calendar',contactId:'contact',startTime:start,endTime:end,appointmentStatus:'confirmed',address:'https://meet.example.test/room'}});
   if(u.pathname==='/contacts/contact/tags'){tagWrites++;assert.deepEqual(body.tags,['meeting booked']);return Response.json({tags:body.tags});}
   if(u.pathname==='/opportunities/search'){assert.equal(u.searchParams.get('contactId'),'contact');assert.equal(u.searchParams.get('locationId'),'location');return Response.json({opportunities:[]});}
   if(u.pathname==='/opportunities/'){opportunityWrites++;assert.equal(body.pipelineStageId,'booked');return Response.json({opportunity:{id:'opportunity'}});}
   if(u.pathname==='/conversations/messages'){assert.equal(body.appointmentId,'appointment');assert.ok(body.message.includes('https://meet.example.test/room'));if(body.type==='Email'){emailSends++;assert.match(body.attachments[0],/\/invite\?expires=.*signature=/);return Response.json({messageId:'email'});}smsSends++;if(smsTimeout)throw Error('lost response');return Response.json({messageId:'sms'});}
   throw Error('Unexpected GHL endpoint '+method+' '+u.pathname);
  }
  throw Error('Unexpected external request '+u.hostname);
 };
 try{
  const call=bind('call-one');const pair=await Promise.all([bookMeeting(call,request),bookMeeting(call,request)]);assert.equal(appointmentCreates,1);assert.ok(pair.some(r=>r.state==='booked'));
  assert.equal((await bookMeeting(call,request)).state,'booked');assert.equal(appointmentCreates,1);
  await assert.rejects(()=>bookMeeting(call,{...request,name:'Changed'}),/already has/);
  await Promise.all([completeBookingSteps(call.operation_key),completeBookingSteps(call.operation_key)]);assert.equal(emailSends,1);assert.equal(smsSends,1);assert.equal(tagWrites,1);assert.equal(opportunityWrites,1);
  await completeBookingSteps(call.operation_key);assert.equal(emailSends,1);assert.equal(smsSends,1);assert.ok(steps.filter(s=>['email','sms'].includes(String(s.kind))).every(s=>s.state==='accepted'&&s.cost_microusd===null));
  free=false;await assert.rejects(()=>bookMeeting(bind('unavailable'),request),/no longer free/);assert.equal(rows.length,1);free=true;
  smsTimeout=true;const second=bind('sms-uncertain');await bookMeeting(second,request);await completeBookingSteps(second.operation_key);assert.equal(steps.find(s=>s.booking_id===rows[1].id&&s.kind==='sms')?.state,'uncertain');const attempts=smsSends;await completeBookingSteps(second.operation_key);assert.equal(smsSends,attempts);
  const third=bind('no-sms');await bookMeeting(third,{...request,smsConsent:false});await completeBookingSteps(third.operation_key);assert.equal(smsSends,attempts);
  const fourth=bind('dnd');await bookMeeting(fourth,request);contactDnd=true;const sent=emailSends;await completeBookingSteps(fourth.operation_key);assert.equal(emailSends,sent);assert.equal(smsSends,attempts);contactDnd=false;
  appointmentTimeout=true;const fifth=bind('booking-uncertain');await assert.rejects(()=>bookMeeting(fifth,request),/not confirmed/);const created=appointmentCreates;assert.equal((await bookMeeting(fifth,request)).state,'uncertain');assert.equal(appointmentCreates,created);
  assert.equal((await configRoute(new Request('https://portal.example.test/api/caller/booking/config'))).status,401);
  const raw=JSON.stringify({name:'nbc_book_meeting',args:request,call:{call_id:'call_foreign',call_status:'ongoing'}}),timestamp=String(Date.now()),signature=`v=${timestamp},d=${createHmac('sha256','test-retell').update(raw+timestamp).digest('hex')}`;
  const post=(sig:string)=>new Request('https://portal.example.test/api/caller/booking/tools',{method:'POST',headers:{'Content-Type':'application/json','x-retell-signature':sig},body:raw});
  assert.equal((await toolRoute(post('invalid'))).status,401);assert.equal((await toolRoute(post(signature))).status,403);assert.equal(appointmentCreates,created);
 }finally{globalThis.fetch=original;names.forEach((k,i)=>{if(prior[i]===undefined)delete process.env[k];else process.env[k]=prior[i];});}
});

test('GHL connection refuses another location and terminal opportunities',async()=>{
 const original=fetch;globalThis.fetch=async(input)=>{const u=new URL(String(input));if(u.pathname.startsWith('/locations'))return Response.json({location:{id:'foreign'}});if(u.pathname.startsWith('/calendars'))return Response.json({calendars:[]});if(u.pathname.endsWith('/pipelines'))return Response.json({pipelines:[]});if(u.pathname.endsWith('/search'))return Response.json({opportunities:[{id:'closed',pipelineId:'pipeline',contactId:'contact',status:'won'}]});throw Error('Unexpected write');};
 try{const ghl=new CallerGhl('fixture','location');await assert.rejects(()=>ghl.options(),/does not match/);await assert.rejects(()=>ghl.opportunity(config,'contact'),/Review existing/);}finally{globalThis.fetch=original;}
});

test('signed tool requests are bound to saved call owner, agent version, recipient and pre-dispatch permission',async()=>{
 const names=['NEXT_PUBLIC_SUPABASE_URL','SUPABASE_SECRET_KEY','CALLER_BOOKING_ENCRYPTION_KEY','RETELL_API_KEY'],previous=names.map(k=>process.env[k]),original=fetch;
 ['https://binding-fixture.supabase.co','fixture',Buffer.alloc(32,9).toString('base64'),'fixture-retell'].forEach((v,i)=>process.env[names[i]]=v);
 const ciphertext=encryptBookingToken(owner,'fixture-ghl');let enabled=true,bound=true,ghlReads=0;
 const call={call_id:'call_fixture',call_status:'ongoing',agent_id:'agent_fixture',agent_version:2,to_number:'+13055550124',from_number:'+13055550100'};
 globalThis.fetch=async(input,init)=>{
  const u=new URL(String(input)),path=u.pathname;
  if(u.hostname==='binding-fixture.supabase.co'){
   if(path.endsWith('nbc_pilot_operations'))return Response.json([{key:'operation',provider:{engine:'retell',callId:'call_fixture'}}]);
   if(path.endsWith('nbc_pilot_rounds'))return Response.json({owner_id:owner});
   if(path.endsWith('nbc_pilot_slots'))return Response.json({config:{retell:{agentId:call.agent_id,version:2,from:call.from_number},destination:call.to_number}});
   if(path.endsWith('caller_booking_calls'))return Response.json(bound?[{owner_id:owner,operation_key:'operation',config,token_ciphertext:ciphertext,phone:call.to_number}]:[]);
   if(path.endsWith('caller_booking_connections'))return Response.json([{owner_id:owner,config:{...config,enabled}}]);
  }
  if(u.hostname==='services.leadconnectorhq.com'&&path.includes('free-slots')){ghlReads++;return Response.json({'2030-01-01':{slots:[start]}});}
  throw Error('Unexpected '+path+' '+init?.method);
 };
 const post=async(c:unknown)=>{const raw=JSON.stringify({name:'nbc_available_slots',call:c,args:{startTime:start,endTime:end,timezone:'America/New_York'}}),t=String(Date.now()),signature=`v=${t},d=${createHmac('sha256','fixture-retell').update(raw+t).digest('hex')}`;return toolRoute(new Request('https://portal.example.test/api/caller/booking/tools',{method:'POST',headers:{'x-retell-signature':signature,'Content-Type':'application/json'},body:raw}));};
 try{
  const success=await post(call);assert.equal(success.status,200,await success.clone().text());assert.equal((await success.json()).slots[0].startTime,start);
  assert.equal((await post({...call,to_number:'+13055550199'})).status,403);
  assert.equal((await post({...call,agent_version:3})).status,403);
  assert.equal((await post({...call,call_status:'ended'})).status,403);
  bound=false;assert.equal((await post(call)).status,403);bound=true;
  enabled=false;assert.equal((await post(call)).status,409);assert.equal(ghlReads,1);
 }finally{globalThis.fetch=original;names.forEach((k,i)=>{if(previous[i]===undefined)delete process.env[k];else process.env[k]=previous[i];});}
});
