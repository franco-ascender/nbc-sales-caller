import { handleLeadEngine } from '@/services/lead-engine.service';
export async function POST(request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  return handleLeadEngine('dryRun', request, (await context.params).id);
}
