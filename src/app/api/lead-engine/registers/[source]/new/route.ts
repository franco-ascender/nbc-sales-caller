import { handleRegisters } from '@/services/lead-engine-registers-http';
// New licensees: names first seen in a snapshot within the last ?days (default 90), masked phones.
export async function GET(request: Request, context: { params: Promise<{ source: string }> }): Promise<Response> { return handleRegisters('new', request, (await context.params).source); }
