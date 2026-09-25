import { LeadEngineError } from '../lib/lead-engine-storage.ts';
import { exactScrapeBody, folderId, parseResearchQuery, parseScrapeInput, scrapeId, scrapeName } from '../lib/lead-engine-scrape.ts';
import type { LeadListPage } from '../lib/lead-engine-scrape.ts';
import type { LeadResearchStore } from './lead-engine-scrape-store.ts';
export type ResearchAction='folders'|'createFolder'|'quote'|'approve'|'lists'|'get'|'sync'|'move';
interface Dependencies {
  authorize(request:Request):Promise<string>;readBody(request:Request):Promise<unknown>;store():LeadResearchStore;
  ready():boolean;start(operator:string,id:string):Promise<void>;sync(operator:string,id:string):Promise<LeadListPage>;
}
export function leadResearchHandler(deps:Dependencies) {
  return async (action:ResearchAction,request:Request,id?:string):Promise<Response>=>{
    try {
      const op=await deps.authorize(request);let result:unknown;
      if(['approve','get','sync','move'].includes(action))id=scrapeId(id);
      if(action==='folders'){parseResearchQuery(request.url);result={folders:await deps.store().folders(op)};}
      else if(action==='createFolder'){const body=exactScrapeBody(await deps.readBody(request),['id','name']);result={folder:await deps.store().createFolder(op,scrapeId(body.id),scrapeName(body.name))};}
      else if(action==='quote'){const input=parseScrapeInput(await deps.readBody(request));const quote=await deps.store().quote(op,input);if(!deps.ready())quote.blockers.push('provider_access_pending');result={quote};}
      else if(action==='approve'){
        exactScrapeBody(await deps.readBody(request),[]);
        if(!deps.ready())throw new LeadEngineError(503,'provider_access_pending','Configure the private scraper account before approving a run.');
        const batch=await deps.store().approve(op,id!);await deps.start(op,batch);result=await deps.store().get(op,batch,0);
      }
      else if(action==='lists'){const q=parseResearchQuery(request.url,true);result=await deps.store().lists(op,q.offset,q.folder);}
      else if(action==='get'){const q=parseResearchQuery(request.url);result=await deps.store().get(op,id!,q.offset);}
      else if(action==='move'){const body=exactScrapeBody(await deps.readBody(request),['folderId']);await deps.store().move(op,id!,folderId(body.folderId));result={moved:true};}
      else {exactScrapeBody(await deps.readBody(request),[]);result=await deps.sync(op,id!);}
      return Response.json(result,{headers:{'Cache-Control':'no-store'}});
    }catch(error){const known=error instanceof LeadEngineError;
      return Response.json({code:known?error.code:'research_unavailable',error:known?error.message:'Research could not be updated. Your saved lists remain available. Refresh the existing list before starting again.'},
        {status:known?error.status:503,headers:{'Cache-Control':'no-store'}});
    }
  };
}
