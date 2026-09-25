import { LeadEngineError, leadUuid, parseLeadDryRun, parseLeadOffset } from '../lib/lead-engine-storage.ts';
import type { LeadEngineStore } from './lead-engine-store.ts';
interface Dependencies { authorize(request: Request): Promise<string>; readBody(request: Request): Promise<unknown>; store(): LeadEngineStore }
type Action = 'list' | 'create' | 'get' | 'dryRun';
export function leadEngineHandler(dependencies: Dependencies) {
  return async (action: Action, request: Request, id?: string): Promise<Response> => {
    try {
      const operator = await dependencies.authorize(request);
      if ((action === 'get' || action === 'dryRun') && !leadUuid(id)) throw new LeadEngineError(400, 'invalid_input', 'A valid plan ID is required.');
      let result: unknown;
      if (action === 'create') result = { plan: await dependencies.store().create(operator, await dependencies.readBody(request)) };
      else if (action === 'list') result = await dependencies.store().list(operator, parseLeadOffset(request.url));
      else if (action === 'get') result = { plan: await dependencies.store().get(operator, id!.toLowerCase()) };
      else { const batchId = parseLeadDryRun(await dependencies.readBody(request)); result = { dryRun: await dependencies.store().dryRun(operator, id!.toLowerCase(), batchId) }; }
      return Response.json(result, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
      if (error instanceof LeadEngineError) return Response.json({ error: error.message, code: error.code }, { status: error.status, headers: { 'Cache-Control': 'no-store' } });
      return Response.json({ error: 'The plan request could not be completed. Keep your draft and retry.', code: 'request_failed' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
    }
  };
}
