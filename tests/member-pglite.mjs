import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const toolRoot=process.argv[2];
if(!toolRoot?.startsWith('/private/tmp/'))throw new Error('Supply isolated PGlite tool directory under /private/tmp.');
const require=createRequire(toolRoot+'/package.json');const {PGlite}=require('@electric-sql/pglite');
const db=new PGlite();
try {
 await db.exec("create schema auth; create table auth.users(id uuid primary key); create role anon; create role authenticated; create role service_role bypassrls; grant usage on schema public to service_role, anon, authenticated;");
 await db.exec(readFileSync('supabase/migrations/202609140030_members.sql','utf8'));
 await db.exec(readFileSync('tests/member-isolated-db.sql','utf8').replace(/^\\set.*$/gm,''));
 console.log(JSON.stringify({passed:true,engine:'PGlite PostgreSQL WASM, ephemeral memory',migration:'applied only to isolated test engine',checks:['DDL and PL/pgSQL parse','idempotent grant','student cannot grant','insufficient credit reservation rejected','partial settlement and retry','release and retry','RLS enabled on all tables','no direct anon/authenticated SELECT','client cannot execute credit RPC'],notVerified:['multi-connection concurrency','Supabase PostgREST/Auth integration']}));
} catch(error) { console.error(JSON.stringify({passed:false,message:error.message,code:error.code,position:error.position,internalPosition:error.internalPosition,internalQuery:error.internalQuery}));process.exitCode=1; }
finally{await db.close();}
