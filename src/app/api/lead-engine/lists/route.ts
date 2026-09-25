import { handleLeadResearch } from '@/services/lead-engine-scrape.service';
export async function GET(request:Request):Promise<Response>{return handleLeadResearch('lists',request);}
