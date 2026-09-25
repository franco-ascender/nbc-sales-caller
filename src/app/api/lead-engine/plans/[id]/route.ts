import { handleLeadEngine } from '@/services/lead-engine.service';
export async function GET(request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  return handleLeadEngine('get', request, (await context.params).id);
}
