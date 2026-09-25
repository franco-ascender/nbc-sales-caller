import { handleLeadResearch } from '@/services/lead-engine-scrape.service';
export async function POST(request:Request):Promise<Response>{return handleLeadResearch('quote',request);}
