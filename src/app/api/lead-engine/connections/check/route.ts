import 'server-only';
import { requireWorkspaceAdmin } from '@/services/workspace-auth';
import { apiError, readJson, IntegrationError } from '@/services/integration.service';
import { checkLeadConnections } from '@/services/lead-engine-connections';
import { leadRecord } from '@/lib/lead-engine-storage';
export async function POST(request: Request): Promise<Response> {
  try {
    await requireWorkspaceAdmin(request);
    const body = await readJson(request);
    if (!leadRecord(body) || Object.keys(body).length !== 0) throw new IntegrationError(400, 'Connection checks do not accept credentials or settings in the request.');
    return Response.json(await checkLeadConnections({ apifyToken: process.env.APIFY_API_TOKEN, outscraperKey: process.env.OUTSCRAPER_API_KEY, phoneVerifierKey: process.env.BATCHDATA_API_KEY }), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return apiError(error instanceof IntegrationError && error.status === 403 ? new IntegrationError(403, 'Administrator access is required to manage lead providers.') : error); }
}
