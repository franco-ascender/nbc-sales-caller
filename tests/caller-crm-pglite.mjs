import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const toolRoot=process.argv[2];if(!toolRoot?.startsWith('/private/tmp/'))throw new Error('Use the isolated PGlite tool directory.');
const {PGlite}=createRequire(toolRoot+'/package.json')('@electric-sql/pglite');const db=new PGlite();
const owner='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222',request='33333333-3333-4333-8333-333333333333';
const fixture=[{name:'C02 Demo One',phone:'+12125550100'},{name:'C02 Duplicate',phone:'+12125550100'},{name:'C02 Demo Two',phone:'+14155550101'}];
const imported=async(o,r,rows)=>(await db.query('select public.caller_import_leads($1::uuid,$2::uuid,$3::jsonb) as result',[o,r,JSON.stringify(rows)])).rows[0].result;
try{
 await db.exec('create schema auth;create table auth.users(id uuid primary key);create role anon;create role authenticated;create role service_role bypassrls;grant usage on schema public to service_role,anon,authenticated;');
 await db.exec(readFileSync('supabase/migrations/202609140040_caller_crm.sql','utf8'));
 await db.query('insert into auth.users(id) values($1),($2)',[owner,other]);
 await db.exec('set role service_role');
 assert.deepEqual(await imported(owner,request,fixture),{imported:2,duplicates:1,replayed:false});
 assert.deepEqual(await imported(owner,request,fixture),{imported:2,duplicates:1,replayed:true});
 await assert.rejects(imported(owner,request,fixture.slice(0,1)),/import_conflict/);
 await db.query("update caller_leads set stage='do_not_call',notes='Keep this' where operator_id=$1 and phone=$2",[owner,fixture[0].phone]);
 assert.equal((await imported(owner,'44444444-4444-4444-8444-444444444444',fixture)).imported,0);
 assert.deepEqual((await db.query('select stage,notes from caller_leads where operator_id=$1 and phone=$2',[owner,fixture[0].phone])).rows[0],{stage:'do_not_call',notes:'Keep this'});
 assert.equal((await imported(other,request,fixture)).imported,2);
 await assert.rejects(imported(owner,'55555555-5555-4555-8555-555555555555',[{name:'Valid',phone:'+16175550102'},{name:'Invalid',phone:'bad'}]));
 assert.equal((await db.query('select count(*)::int n from caller_leads')).rows[0].n,4);
 for(const role of ['anon','authenticated']){await db.exec('reset role;set role '+role);await assert.rejects(db.query('select * from caller_leads'),/permission denied/);await assert.rejects(imported(owner,request,fixture),/permission denied/);}
 await db.exec('reset role');assert.equal((await db.query("select count(*)::int n from pg_class where relname in ('caller_leads','caller_imports','caller_voice_jobs') and relrowsecurity")).rows[0].n,3);
 console.log(JSON.stringify({passed:true,engine:'PGlite PostgreSQL WASM',checks:10,migration:'isolated only',covers:['DDL/PLpgSQL','atomic import','deduplication','owner separation','idempotent retry','payload conflict','DNC preservation','invalid import rollback','direct client denial','RLS'],notVerified:['PostgREST live','multi-connection concurrency']}));
}catch(error){console.error(JSON.stringify({passed:false,message:error.message,code:error.code}));process.exitCode=1;}finally{await db.close();}
