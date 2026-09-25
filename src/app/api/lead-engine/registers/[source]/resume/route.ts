import { handleRegisters } from '@/services/lead-engine-registers-http';
export async function POST(request: Request, context: { params: Promise<{ source: string }> }): Promise<Response> { return handleRegisters('resume', request, (await context.params).source); }
