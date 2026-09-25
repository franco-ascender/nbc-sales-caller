import "server-only";
import { ghlConfigured } from "@/services/tracker-ghl.service";
import { metaConfigured } from "@/services/tracker-meta.service";
import { stripeConfigured } from "@/services/tracker-stripe.service";
import type { TrackerConnectionStatus } from "@/lib/tracker-types";

// "configured" means env vars are present, not that the credential was verified against
// the provider. No network call here; verification happens when a snapshot is fetched.
export function trackerConnectionStatus(): TrackerConnectionStatus {
  return {
    ghl: ghlConfigured() ? "configured" : "not_configured",
    meta: metaConfigured() ? "configured" : "not_configured",
    stripe: stripeConfigured() ? "configured" : "not_configured",
  };
}
