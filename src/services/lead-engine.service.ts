import 'server-only';
import { database, IntegrationError, readJson } from './integration.service';
import { requireLeadOperator } from './lead-engine-auth';
import { LeadEngineError } from '../lib/lead-engine-storage';
import { createLeadEngineStore } from './lead-engine-store';
import { leadEngineHandler } from './lead-engine-http';
async function common<T>(operation: () => Promise<T>): Promise<T> {
  try { return await operation(); }
  catch (error) {
    if (error instanceof IntegrationError) throw new LeadEngineError(error.status, error.status === 503 ? 'access_pending' : 'access_or_input_error', error.message);
    throw error;
  }
}
export const handleLeadEngine = leadEngineHandler({
  authorize: request => common(() => requireLeadOperator(request)),
  readBody: request => common(() => readJson(request)),
  store: () => {
    try { return createLeadEngineStore(database()); }
    catch { throw new LeadEngineError(503, 'storage_pending', 'Plan storage is pending configuration. Your draft is still available to export.'); }
  },
});
