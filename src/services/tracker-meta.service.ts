import "server-only";
import { IntegrationError } from "@/services/integration.service";
import type { TrackerRange, TrackerSnapshot } from "@/lib/tracker-types";

// Same contract as tracker-ghl.service.ts (fetchGhlSnapshot). This is the "swap the API"
// point: once Meta Marketing API credentials exist, this function calls the Ads Insights
// endpoint and returns the same TrackerSnapshot shape; nothing above this layer changes.
export function metaConfigured(): boolean {
  return Boolean(process.env.META_ACCESS_TOKEN && process.env.META_AD_ACCOUNT_ID);
}

export async function fetchMetaSnapshot(_range: TrackerRange): Promise<TrackerSnapshot> {
  if (!metaConfigured()) throw new IntegrationError(503, "Meta Ads has not been configured yet.");
  throw new IntegrationError(503, "Meta Ads connector is not implemented yet.");
}
