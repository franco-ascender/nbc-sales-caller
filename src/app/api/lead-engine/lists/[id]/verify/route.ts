import 'server-only';
import { database, IntegrationError, readJson, apiError } from '@/services/integration.service';
import { requireLeadOperator } from '@/services/lead-engine-auth';
import { LeadEngineError, leadRecord, leadUuid } from '@/lib/lead-engine-storage';
import { verifyListPhones } from '@/services/lead-engine-verify.service';

// Paid, one charge per number. Reached only by an explicit operator action; never on a schedule.
export async function POST(request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    const operator = await requireLeadOperator(request).catch((error: unknown) => {
      throw error instanceof IntegrationError ? new LeadEngineError(error.status, 'access_pending', error.message) : error;
    });
    const body = await readJson(request);
    if (!leadRecord(body) || Object.keys(body).length !== 0) throw new LeadEngineError(400, 'invalid_input', 'This action takes no settings.');
    const { id } = await context.params;
    if (!leadUuid(id)) throw new LeadEngineError(400, 'invalid_input', 'A valid list is required.');
    const key = process.env.BATCHDATA_API_KEY;
    if (!key) throw new LeadEngineError(503, 'provider_access_pending', 'The phone verification account is not configured.');
    const db = (() => { try { return database(); } catch { throw new LeadEngineError(503, 'storage_pending', 'Research storage is pending configuration.'); } })();
    return Response.json(await verifyListPhones(db, operator, id, key), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (!(error instanceof LeadEngineError)) return apiError(error);
    return Response.json({ code: error.code, error: error.message }, { status: error.status, headers: { 'Cache-Control': 'no-store' } });
  }
}
