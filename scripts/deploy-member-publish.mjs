// Publish only the verified runtime snapshot, never the shared working tree.
import {loadEnvFile} from 'node:process';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
loadEnvFile('.env.local');
const revision=process.argv[2]||'I02-R2';
if(!['I02-R2','I02-R3','I02-R4'].includes(revision))throw Error('Unknown member candidate');
const out=revision==='I02-R4'?'artifacts/lanes/I02/navigation':revision==='I02-R3'?'artifacts/lanes/I02/login':'artifacts/lanes/I02/activation';
const stage=JSON.parse(readFileSync(out+'/staging.json')).path;
const manifest=JSON.parse(readFileSync(out+'/runtime-manifest.json'));
const hash=createHash('sha256').update(JSON.stringify(manifest)).digest('hex');
const privateValues=Object.entries(process.env).filter(([key,value])=>value&&value.length>8&&!key.startsWith('NEXT_PUBLIC_')&&/SECRET|TOKEN|PASSWORD|API_KEY|NBC_OPERATOR_EMAIL/.test(key)).map(([,value])=>value);
const privateDir=readFileSync('artifacts/lanes/I02/private-access-location.txt','utf8').trim();
privateValues.push(...JSON.parse(readFileSync(privateDir+'/auth-accounts.json')).accounts.map(a=>a.initialPassword).filter(Boolean));
const files=Object.entries(manifest).map(([file,sha])=>{
 if(file.startsWith('.env')||/^(docs|tests|scripts|artifacts|supabase)\//.test(file))throw Error('Unexpected deployment file');
 const data=readFileSync(join(stage,file));if(createHash('sha256').update(data).digest('hex')!==sha)throw Error('Snapshot changed: '+file);
 if(privateValues.some(value=>data.includes(Buffer.from(value))))throw Error('Private value in upload');
 return {file,data:data.toString('base64'),encoding:'base64'};
});
const r=await fetch(`https://api.vercel.com/v13/deployments?teamId=${process.env.VERCEL_TEAM_ID}`,{method:'POST',headers:{Authorization:`Bearer ${process.env.VERCEL_TOKEN}`,'Content-Type':'application/json'},body:JSON.stringify({name:'nbc-sales',project:process.env.VERCEL_PROJECT_ID,target:'staging',files,meta:{memberCandidate:revision,callerCandidate:revision==='I02-R4'?'C02-R1':'C01-R1',...(revision==='I02-R4'?{academyCandidate:'K01-R3'}:{}),memberManifest:hash}}),signal:AbortSignal.timeout(60000)});
const d=await r.json();const result={at:new Date().toISOString(),status:r.status,id:d.id,url:d.url,target:d.target,readyState:d.readyState,errorCode:d.error?.code??null,files:files.length,runtimeManifestSha256:hash};
writeFileSync(out+'/deployment.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));if(!r.ok)process.exitCode=1;
