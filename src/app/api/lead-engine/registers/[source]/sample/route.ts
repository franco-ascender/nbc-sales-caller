import { handleRegisters } from '@/services/lead-engine-registers-http';
// A few normalized names rows with masked phones, for eyeballing an adapter's output.
export async function GET(request: Request, context: { params: Promise<{ source: string }> }): Promise<Response> { return handleRegisters('sample', request, (await context.params).source); }
