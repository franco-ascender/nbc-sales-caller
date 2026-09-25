import 'server-only';
import { database, IntegrationError, readJson } from './integration.service';
import { requireLeadOperator } from './lead-engine-auth';
import { LeadEngineError } from '../lib/lead-engine-storage';
import { parseDiscoveryCandidate } from '../lib/lead-engine-scrape';
import { createLeadResearchStore } from './lead-engine-scrape-store';
import { leadResearchHandler } from './lead-engine-scrape-http';
import { createDiscoveryWorker } from './lead-engine-discovery';
import { createDiscoveryStore } from './lead-engine-discovery-store';
import { createApifyDiscoveryProvider } from './lead-engine-apify';
import { createLeadDatasetReader } from './lead-engine-dataset';
import { createLeadEngineStore } from './lead-engine-store';
async function common<T>(fn:()=>Promise<T>):Promise<T>{try{return await fn();}catch(e){if(e instanceof IntegrationError)throw new LeadEngineError(e.status,'access_pending',e.message);throw e;}}
function db(){try{return database();}catch{throw new LeadEngineError(503,'storage_pending','Research storage is pending configuration. Your draft remains available.');}}
function providerToken():string {const token=process.env.APIFY_API_TOKEN;if(!token)throw new LeadEngineError(503,'provider_access_pending','The private scraper account is not configured.');return token;}
export const handleLeadResearch=leadResearchHandler({
  authorize:req=>common(()=>requireLeadOperator(req)),readBody:req=>common(()=>readJson(req)),store:()=>createLeadResearchStore(db()),ready:()=>Boolean(process.env.APIFY_API_TOKEN),
  async start(op,id){const connection=db();await createDiscoveryWorker(createDiscoveryStore(connection),createApifyDiscoveryProvider(providerToken())).start(op,id);},
  async sync(op,id){
    const connection=db(),store=createLeadResearchStore(connection),jobs=createDiscoveryStore(connection);
    // Ownership before any provider access. No client-supplied run or dataset identity.
    const current=await store.get(op,id,0);if(current.list.importStatus==='complete')return current;
    let job=await jobs.get(op,id);
    if(job.status==='running')job=await createDiscoveryWorker(jobs,createApifyDiscoveryProvider(providerToken())).sync(op,id);
    if(job.status==='succeeded'&&job.datasetId){
      const page=await createLeadDatasetReader(providerToken())(job.datasetId,current.list.processed,job.maxResults);
      const plan=await createLeadEngineStore(connection).get(op,job.planId);
      await store.ingest(op,id,page.offset,page.total,page.rows.map(row=>parseDiscoveryCandidate(row,plan.input)));
    }
    return store.get(op,id,0);
  },
});
