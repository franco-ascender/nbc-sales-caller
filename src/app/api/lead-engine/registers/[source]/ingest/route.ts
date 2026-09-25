import { handleRegisters } from '@/services/lead-engine-registers-http';
// One bounded ingest step of a public register: fetch segments while the budget lasts, write, save the cursor.
export const maxDuration = 60;
export async function POST(request: Request, context: { params: Promise<{ source: string }> }): Promise<Response> { return handleRegisters('ingest', request, (await context.params).source); }
