import { handleLeadResearch } from '@/services/lead-engine-scrape.service';
export async function GET(request:Request, context:{params:Promise<{id:string}>}):Promise<Response>{return handleLeadResearch('get',request,(await context.params).id);}
