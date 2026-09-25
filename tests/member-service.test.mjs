import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const require = createRequire(import.meta.url);
const ts = require('typescript');
const folder = mkdtempSync('/private/tmp/nbc-member-service-test-');
// Compile the actual service and validation source for Node; only the Next
// server-only marker and package resolution change in this test harness.
for (const [source, name] of [['src/lib/member-validation.ts','member-validation'],['src/services/member-workspace.ts','member-workspace']]) {
  let code = ts.transpileModule(readFileSync(source, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
  code = code.replace('import "server-only";', '').replace('"@/lib/member-validation"', '"./member-validation.mjs"').replace('"@supabase/supabase-js"', JSON.stringify(pathToFileURL(require.resolve('@supabase/supabase-js')).href));
  writeFileSync(`${folder}/${name}.mjs`, code);
}
const { requireMember, mutateMemberWorkspace, readMemberWorkspace } = await import(pathToFileURL(`${folder}/member-workspace.mjs`).href);
const ids = { student:'00000000-0000-4000-8000-000000000001', other:'00000000-0000-4000-8000-000000000002', coach:'00000000-0000-4000-8000-000000000003' };
const student = { id:ids.student,display_name:'TEST student',role:'student',status:'active',coach_id:ids.coach };
const other = { ...student,id:ids.other,coach_id:null };
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://member-test.invalid';
process.env.SUPABASE_SECRET_KEY = 'test-service-key-not-a-real-secret';
const originalFetch = globalThis.fetch;
let calls; let membership; let confirmed; let onboarding;
function setup() {
  calls=[]; membership=student; confirmed=true; onboarding=null;
  globalThis.fetch = async (input, options = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url ?? input.href);
    const method = options.method || 'GET'; const body = options.body ? JSON.parse(options.body) : null;
    calls.push({ url,method,body });
    assert.equal(url.origin,'https://member-test.invalid','Unexpected external request');
    const json = (data, status=200) => new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
    if (url.pathname === '/auth/v1/user') return json({id:ids.student,email:'fixture@example.invalid',email_confirmed_at:confirmed?'2026-01-01T00:00:00Z':null,user_metadata:{role:'admin'}});
    if (url.pathname === '/rest/v1/nbc_members') {
      const id=url.searchParams.get('id')?.slice(3); const row=id===ids.other?other:membership;
      return json(row?[row]:[]);
    }
    if (url.pathname === '/rest/v1/nbc_onboarding') return method==='GET'?json(onboarding?[onboarding]:[]):new Response(null,{status:201});
    if (url.pathname === '/rest/v1/nbc_tickets') {
      if (method==='GET') return json([]);
      return new Response(null,{status:201});
    }
    throw new Error(`Unexpected service call ${method} ${url.pathname}`);
  };
}
const request = () => new Request('http://127.0.0.1/api/members',{headers:{Authorization:'Bearer test-token'}});
test.after(() => { globalThis.fetch=originalFetch; });
test('anonymous rejection happens before any database or Auth request', async () => {setup();await assert.rejects(requireMember(new Request('http://127.0.0.1/api/members')),e=>e.status===401);assert.equal(calls.length,0);});
test('role comes from the membership table, never user metadata', async()=>{setup();const user=await requireMember(request());assert.equal(user.role,'student');});
test('unconfirmed, absent and suspended memberships are denied',async()=>{setup();confirmed=false;await assert.rejects(requireMember(request()),e=>e.status===401);setup();membership=null;await assert.rejects(requireMember(request()),e=>e.status===403);setup();membership={...student,status:'suspended'};await assert.rejects(requireMember(request()),e=>e.status===403);});
test('student cannot read another workspace before private tables are queried',async()=>{setup();await assert.rejects(readMemberWorkspace(student,new Request(`http://127.0.0.1/api/members?member=${ids.other}`)),e=>e.status===404);assert(calls.every(c=>c.url.pathname==='/rest/v1/nbc_members'));});
test('student cannot grant credits or create calendar sessions',async()=>{setup();await assert.rejects(mutateMemberWorkspace(student,{action:'grant',amount:100,memberId:ids.student}),e=>e.status===403);await assert.rejects(mutateMemberWorkspace(student,{action:'event'}),e=>e.status===403);assert(!calls.some(c=>c.method==='POST'));});
test('onboarding ignores client-supplied owner and persists authenticated member',async()=>{setup();await mutateMemberWorkspace(student,{action:'onboarding',memberId:ids.other,business:'TEST business',timezone:'America/New_York',goal:'TEST goal',questions:'TEST question',complete:true});const write=calls.find(c=>c.method==='POST');assert.equal(write.body.member_id,ids.student);assert(write.body.completed_at);});
test('completed onboarding cannot be emptied through Save draft',async()=>{setup();onboarding={completed_at:'2026-01-01T00:00:00Z'};await assert.rejects(mutateMemberWorkspace(student,{action:'onboarding',business:'',timezone:'America/New_York',goal:'',questions:'',complete:false}),e=>e.status===400);assert(!calls.some(c=>c.method==='POST'));});
test('tickets cannot be created on behalf of another member',async()=>{setup();await assert.rejects(mutateMemberWorkspace(student,{action:'ticket',memberId:ids.other,title:'x',body:'x'}),e=>e.status===404);assert(!calls.some(c=>c.method==='POST'));});
