import './academy-test-loader.mjs';
import test from 'node:test';import assert from 'node:assert/strict';
const upload=await import('../src/app/api/academy/covers/route.ts');
const read=await import('../src/app/api/academy/covers/[id]/route.ts');
const owner='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
const jpeg=new Uint8Array([255,216,255,192,0,17,8,2,208,5,0,3,1,17,0,2,17,0,3,17,0,255,217]);
test('cover routes verify admin, bound bytes and private owner path; storage errors keep details private',async()=>{
 const beforeFetch=globalThis.fetch,names=['NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY','SUPABASE_SECRET_KEY','NBC_OPERATOR_EMAIL'],before=names.map(n=>process.env[n]);['https://academy-cover-fixture.supabase.co','fixture-public','fixture-secret','operator@example.test'].forEach((v,i)=>process.env[names[i]]=v);
 const objects=new Map<string,Uint8Array>();let actor=owner,role='admin',storageCalls=0,missing=false;
 globalThis.fetch=async(input,init)=>{const url=new URL(typeof input==='string'||input instanceof URL?input:input.url),headers=new Headers(init?.headers);assert.equal(url.hostname,'academy-cover-fixture.supabase.co');
 if(url.pathname==='/auth/v1/user'){const token=headers.get('authorization');role=token==='Bearer student'?'student':token==='Bearer coach'?'coach':'admin';actor=token==='Bearer other'?other:owner;return Response.json({id:actor,email:'operator@example.test',email_confirmed_at:'2026-09-15T00:00:00Z'});}
 if(url.pathname.endsWith('/nbc_members'))return Response.json([{id:actor,display_name:'Fixture',role,status:'active'}]);
 storageCalls++;if(url.pathname==='/storage/v1/bucket/academy-covers')return missing?Response.json({message:'Private infrastructure detail',statusCode:'404'},{status:404}):Response.json({id:'academy-covers',name:'academy-covers',public:false});
 assert(url.pathname.startsWith('/storage/v1/object/'));const key=url.pathname.replace('/storage/v1/object/authenticated/','').replace('/storage/v1/object/','');assert(key.startsWith('academy-covers/'+actor+'/'));
 if(init?.method==='POST'){assert.equal(headers.get('x-upsert'),'false');assert.equal(headers.get('content-type'),'image/jpeg');objects.set(key,new Uint8Array(init.body as Uint8Array));return Response.json({Key:key,Id:'fixture-object'});}
 return objects.has(key)?new Response(new Uint8Array(objects.get(key)!),{headers:{'Content-Type':'image/jpeg'}}):Response.json({message:'not found',statusCode:'404'},{status:404});};
 const req=(token:string|null,body?:Uint8Array,type='image/jpeg')=>new Request('https://local/api/academy/covers',{method:body?'POST':'GET',headers:{...(token?{Authorization:'Bearer '+token}:{}),'Content-Type':type},...(body?{body:new Uint8Array(body)}: {})});
 try{
 for(const token of [null,'student','coach'])assert.equal((await upload.POST(req(token,jpeg))).status,token?403:401);assert.equal(storageCalls,0);
 assert.equal((await upload.POST(req('admin',new TextEncoder().encode('<svg/>')))).status,400);assert.equal(storageCalls,0);
 const response=await upload.POST(req('admin',jpeg));assert.equal(response.status,201);const{coverId}=await response.json();const ctx={params:Promise.resolve({id:coverId})};
 const found=await read.GET(req('admin'),ctx);assert.equal(found.status,200);assert.equal(found.headers.get('x-content-type-options'),'nosniff');assert.equal(found.headers.get('cache-control'),'private, no-store');assert.deepEqual(new Uint8Array(await found.arrayBuffer()),jpeg);
 assert.equal((await read.GET(req('other'),ctx)).status,404);assert.equal((await read.GET(req('student'),ctx)).status,403);
 missing=true;const pending=await upload.POST(req('admin',jpeg));assert.equal(pending.status,503);assert.equal((await pending.json()).code,'storage_pending');assert.equal(objects.size,1);
 }finally{globalThis.fetch=beforeFetch;names.forEach((n,i)=>{if(before[i]===undefined)delete process.env[n];else process.env[n]=before[i];});}
});
