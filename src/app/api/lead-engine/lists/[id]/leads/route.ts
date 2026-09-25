import 'server-only';
import { database, IntegrationError, apiError } from '@/services/integration.service';
import { requireLeadOperator } from '@/services/lead-engine-auth';
import { LeadEngineError, leadUuid } from '@/lib/lead-engine-storage';
import { readListLeads } from '@/services/lead-engine-verify.service';

// Full records for the operator who paid for them, phone numbers included. Read-only; spends nothing.
export async function GET(request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    const operator = await requireLeadOperator(request).catch((error: unknown) => {
      throw error instanceof IntegrationError ? new LeadEngineError(error.status, 'access_pending', error.message) : error;
    });
    const { id } = await context.params;
    if (!leadUuid(id)) throw new LeadEngineError(400, 'invalid_input', 'A valid list is required.');
    const db = (() => { try { return database(); } catch { throw new LeadEngineError(503, 'storage_pending', 'Research storage is pending configuration.'); } })();
    return Response.json({ leads: await readListLeads(db, operator, id) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (!(error instanceof LeadEngineError)) return apiError(error);
    return Response.json({ code: error.code, error: error.message }, { status: error.status, headers: { 'Cache-Control': 'no-store' } });
  }
}
