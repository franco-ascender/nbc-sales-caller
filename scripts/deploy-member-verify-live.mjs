// Explicit activation verification: real temporary accounts and private persistence.
// Removes only IDs created by this run. Never prints tokens/passwords or sends email.
import {loadEnvFile} from 'node:process';
import {readFileSync,writeFileSync} from 'node:fs';
import {randomUUID,randomBytes} from 'node:crypto';
import assert from 'node:assert/strict';
import {createClient} from '@supabase/supabase-js';
loadEnvFile('.env.local');
const origin=process.argv[2]; if(!origin)throw Error('Supply deployed origin');
const out='artifacts/lanes/I02/activation';
const settings={auth:{persistSession:false,autoRefreshToken:false}};
const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SECRET_KEY,settings);
const users=[];const clients=[];const checks=[];let cleanup=false;
const check=(name)=>checks.push(name);
function checked(r){if(r.error)throw Error(`Database check failed: ${r.error.code}`);return r.data;}
async function api(token,body,member){const r=await fetch(origin+'/api/members'+(member?'?member='+member:''),{method:body?'POST':'GET',headers:{Authorization:`Bearer ${token}`,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,data:await r.json()};}
async function sql(query){const r=await fetch(`https://api.supabase.com/v1/projects/${process.env.SUPABASE_PROJECT_REF}/database/query`,{method:'POST',headers:{Authorization:`Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`,'Content-Type':'application/json'},body:JSON.stringify({query,read_only:false})});if(!r.ok)throw Error(`Verification SQL HTTP ${r.status}`);return r.json();}
try{
 const privateDir=readFileSync('artifacts/lanes/I02/private-access-location.txt','utf8').trim();
 const admins=JSON.parse(readFileSync(privateDir+'/auth-accounts.json')).accounts;
 let adminToken;
 for(const row of admins){const c=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,settings);clients.push(c);const auth=checked(await c.auth.signInWithPassword({email:row.email,password:row.initialPassword}));const w=await api(auth.session.access_token);assert.equal(w.status,200);assert.equal(w.data.member.role,'admin');assert.equal(w.data.member.status,'active');adminToken??=auth.session.access_token;check(row.display_name+': real admin workspace 200');}
 for(const role of ['coach','student','student']){
  const email=`nbc-activation-${randomUUID()}@example.invalid`,password=randomBytes(24).toString('base64url');
  const created=checked(await db.auth.admin.createUser({email,password,email_confirm:true}));users.push(created.user.id);
  checked(await db.from('nbc_members').insert({id:created.user.id,display_name:'ACTIVATION TEST '+role,role}));
  const c=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,settings);clients.push(c);const auth=checked(await c.auth.signInWithPassword({email,password}));created.user.token=auth.session.access_token;
  users[users.length-1]={id:created.user.id,token:created.user.token,client:c};
 }
 const [coach,student,other]=users;
 assert.equal((await api(adminToken,{action:'assignCoach',memberId:student.id,coachId:coach.id})).status,200);
 assert.equal((await api(student.token,{action:'onboarding',business:'ACTIVATION TEST',timezone:'America/New_York',goal:'Verify persistence',questions:'Test only',complete:true})).status,200);
 assert.equal((await api(student.token)).data.onboarding.business,'ACTIVATION TEST');check('Real onboarding saved and reloaded');
 assert.equal((await api(coach.token,null,student.id)).status,200);
 assert.equal((await api(coach.token,null,other.id)).status,404);
 assert.equal((await api(student.token,null,other.id)).status,404);check('Assigned coach access and cross-member denial');
 const eventId=randomUUID();assert.equal((await api(coach.token,{action:'event',id:eventId,memberId:student.id,title:'ACTIVATION TEST',startsAt:new Date(Date.now()+3600000).toISOString(),endsAt:new Date(Date.now()+7200000).toISOString(),joinUrl:'https://example.invalid/activation-test'})).status,200);
 assert((await api(student.token)).data.events.some(e=>e.id===eventId));assert(!(await api(other.token)).data.events.some(e=>e.id===eventId));check('Private calendar persistence and isolation');
 const message={action:'message',id:randomUUID(),body:'ACTIVATION TEST message'};assert.equal((await api(student.token,message)).status,200);assert.equal((await api(student.token,message)).status,200);
 assert.equal((await api(coach.token,null,student.id)).data.messages.filter(m=>m.id===message.id).length,1);check('Real mentor message and idempotent retry');
 const ticket={action:'ticket',id:randomUUID(),title:'ACTIVATION TEST',body:'Verify support persistence'};assert.equal((await api(student.token,ticket)).status,200);assert.equal((await api(coach.token,{action:'ticketStatus',id:ticket.id,memberId:student.id,status:'resolved'})).status,200);assert.equal((await api(student.token)).data.tickets.find(t=>t.id===ticket.id).status,'resolved');check('Real support ticket and resolution');
 const grant={action:'grant',id:randomUUID(),memberId:student.id,amount:100,reason:'ACTIVATION TEST'};assert.equal((await api(student.token,grant)).status,403);assert.equal((await api(adminToken,grant)).status,200);assert.equal((await api(adminToken,grant)).status,200);assert.equal((await api(student.token)).data.credits.available,100);check('Admin allocation, student denial, retry exactly once');
 const operations=[randomUUID(),randomUUID()];
 const attempts=await Promise.all(operations.map(id=>db.rpc('nbc_credit_apply',{p_action:'reserve',p_member:student.id,p_operation:id,p_amount:70,p_reason:'ACTIVATION TEST',p_actor:student.id})));
 assert.equal(attempts.filter(r=>!r.error).length,1);assert.equal(attempts.filter(r=>r.error?.message==='insufficient_credits').length,1);
 const winning=operations[attempts.findIndex(r=>!r.error)];const reserved=(await api(student.token)).data.credits;assert.equal(reserved.available,30);assert.equal(reserved.reserved,70);check('Two concurrent PostgREST reservations: one success, one insufficient credits');
 const settle={p_action:'settle',p_member:student.id,p_operation:winning,p_amount:50,p_reason:'ACTIVATION TEST',p_actor:student.id};checked(await db.rpc('nbc_credit_apply',settle));checked(await db.rpc('nbc_credit_apply',settle));assert.equal((await api(student.token)).data.credits.available,50);check('Real settlement retry debits once');
 const releaseId=randomUUID();checked(await db.rpc('nbc_credit_apply',{...settle,p_action:'reserve',p_operation:releaseId,p_amount:20}));checked(await db.rpc('nbc_credit_apply',{...settle,p_action:'release',p_operation:releaseId,p_amount:0}));checked(await db.rpc('nbc_credit_apply',{...settle,p_action:'release',p_operation:releaseId,p_amount:0}));assert.equal((await api(student.token)).data.credits.reserved,0);check('Real reserve/release retries restore availability');
 for(const table of ['nbc_members','nbc_onboarding','nbc_calendar','nbc_messages','nbc_tickets','nbc_credit_wallets','nbc_credit_operations','nbc_credit_entries'])assert((await student.client.from(table).select('*').limit(1)).error,'Direct access must fail');
 assert((await student.client.rpc('nbc_credit_apply',settle)).error);check('All eight tables and credit RPC deny direct authenticated access');
}finally{
 const ids=users.map(u=>typeof u==='string'?u:u.id);if(ids.length){assert(ids.every(id=>/^[0-9a-f-]{36}$/.test(id)));const list=ids.map(id=>`'${id}'`).join(',');
  await sql(`begin; delete from public.nbc_credit_entries where member_id in (${list}); delete from public.nbc_credit_operations where member_id in (${list}); delete from public.nbc_credit_wallets where member_id in (${list}); delete from public.nbc_tickets where member_id in (${list}); delete from public.nbc_messages where student_id in (${list}) or author_id in (${list}); delete from public.nbc_calendar where creator_id in (${list}) or student_id in (${list}); delete from public.nbc_onboarding where member_id in (${list}); delete from public.nbc_members where id in (${list}); commit;`);
  for(const id of ids)checked(await db.auth.admin.deleteUser(id));
 }
 for(const c of clients)await c.auth.signOut({scope:'local'});cleanup=true;
 writeFileSync(`${out}/live-persistence.json`,JSON.stringify({at:new Date().toISOString(),origin,checks,temporaryAccountsRemoved:ids.length,cleanup,passed:checks.length===12},null,2)+'\n');
}
console.log(JSON.stringify({checks:checks.length,cleanup,passed:checks.length===12}));
