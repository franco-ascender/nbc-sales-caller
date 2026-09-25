import { handleLeadResearch } from '@/services/lead-engine-scrape.service';
export async function POST(request:Request, context:{params:Promise<{id:string}>}):Promise<Response>{return handleLeadResearch('approve',request,(await context.params).id);}
