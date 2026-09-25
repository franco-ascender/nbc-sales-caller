import 'server-only';
import { database, IntegrationError, apiError } from './integration.service';
import { requireLeadOperator } from './lead-engine-auth';
import { LeadEngineError } from '../lib/lead-engine-storage';
import { ingestChunk, newLicensees, parseLimit, registerSummary, resumeRun, sampleNames } from './lead-engine-registers.service';

// One handler for the register routes. Every action authenticates the operator first (same guard as the
// jobs routes) and touches nothing before that. Ingest is free (public GETs) but still an operator action.
export type RegisterAction = 'summary' | 'ingest' | 'resume' | 'sample' | 'new';

const headers = { 'Cache-Control': 'no-store' };
function db() { try { return database(); } catch { throw new LeadEngineError(503, 'storage_pending', 'Storage is pending configuration.'); } }
async function operatorOf(request: Request): Promise<string> {
  try { return await requireLeadOperator(request); }
  catch (error) { throw error instanceof IntegrationError ? new LeadEngineError(error.status, 'access_pending', error.message) : error; }
}

export async function handleRegisters(action: RegisterAction, request: Request, source?: string): Promise<Response> {
  try {
    const operator = await operatorOf(request);
    const query = new URL(request.url).searchParams;
    let result: unknown;
    switch (action) {
      case 'summary': result = await registerSummary(db()); break;
      case 'ingest': result = await ingestChunk(db(), operator, source ?? ''); break;
      case 'resume': result = { run: await resumeRun(db(), operator, source ?? '') }; break;
      case 'sample': result = await sampleNames(db(), source ?? '', parseLimit(query.get('limit'), 20, 200)); break;
      case 'new': result = await newLicensees(db(), source ?? '', parseLimit(query.get('days'), 90, 3650), parseLimit(query.get('limit'), 200, 2000)); break;
    }
    return Response.json(result, { headers });
  } catch (error) {
    if (!(error instanceof LeadEngineError)) return apiError(error);
    return Response.json({ code: error.code, error: error.message }, { status: error.status, headers });
  }
}
