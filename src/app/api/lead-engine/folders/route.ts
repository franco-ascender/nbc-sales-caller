import { handleLeadResearch } from '@/services/lead-engine-scrape.service';
export async function GET(request:Request):Promise<Response>{return handleLeadResearch('folders',request);}
export async function POST(request:Request):Promise<Response>{return handleLeadResearch('createFolder',request);}
