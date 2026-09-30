import {requireWorkspaceAdmin} from '@/services/workspace-auth';
import {IntegrationError,apiError} from '@/services/integration.service';
import {pilotView} from '@/services/live-pilot.service';
import {runEvidenceRows,runEvidenceCsv} from '@/lib/run-review';
import {writeWorkbook} from '@/lib/lead-engine-xlsx';
export async function GET(request:Request,{params}:{params:Promise<{key:string}>}){try{const user=await requireWorkspaceAdmin(request),{key}=await params,p=new URL(request.url).searchParams,format=p.get('format')??'csv';if(!['csv','xlsx'].includes(format))throw new IntegrationError(400,'Choose CSV or Excel.');const slot=(await pilotView(user.id)).slots.find(s=>s.key===key&&s.kind==='scrape');if(!slot)throw new IntegrationError(404,'List not found.');const qualified=p.get('qualified')==='true',name=slot.title.replace(/[^a-zA-Z0-9_-]/g,'-').slice(0,80)||'lead-list';
const body=format==='csv'?'\uFEFF'+runEvidenceCsv(slot.result,qualified):Buffer.from(writeWorkbook([{name:'Contacts',rows:runEvidenceRows(slot.result,qualified).map(row=>row.map(v=>v??null))}]));
return new Response(body,{headers:{'Content-Type':format==='csv'?'text/csv;charset=utf-8':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','Content-Disposition':`attachment; filename="${name}${qualified?'-verified-mobile':''}.${format}"`,'Cache-Control':'no-store'}});}catch(e){return apiError(e);}}
