// Local checks only. Does not load .env, start providers, migrate, or publish.
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
const folder = new URL('../artifacts/lanes/L03/industry-workflows/',import.meta.url);
mkdirSync(folder,{recursive:true});
const checks = [
  ['unit','npm',['test']],
  ['python','npm',['run','test:py']],
  ['typescript','node',['node_modules/typescript/bin/tsc','--noEmit','--incremental','false']],
];
const results=[];
for(const [id,command,args]of checks){
  const start=new Date().toISOString();
  const result=spawnSync(command,args,{encoding:'utf8',maxBuffer:8*1024*1024});
  const output=(result.stdout??'')+(result.stderr??'');
  writeFileSync(new URL(`${id}.log`,folder),output);
  results.push({id,command:[command,...args].join(' '),startedAt:start,exitCode:result.status,error:result.error?.name??null});
  console.log(`${id}: ${result.status===0?'PASS':'FAIL'}\n${output.split('\n').slice(-10).join('\n')}`);
}
writeFileSync(new URL('local-validation.json',folder),JSON.stringify(results,null,2)+'\n');
if(results.some(result=>result.exitCode!==0))process.exitCode=1;
