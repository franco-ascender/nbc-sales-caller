import { handleLeadEngine } from '@/services/lead-engine.service';
export async function GET(request: Request): Promise<Response> { return handleLeadEngine('list', request); }
export async function POST(request: Request): Promise<Response> { return handleLeadEngine('create', request); }
