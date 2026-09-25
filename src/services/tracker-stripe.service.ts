import "server-only";
import { IntegrationError } from "@/services/integration.service";
import type { TrackerRange, TrackerSnapshot } from "@/lib/tracker-types";

// Same contract as tracker-ghl.service.ts (fetchGhlSnapshot). Deliberately a distinct
// credential from STRIPE_SECRET_KEY (which funds NBC Credits checkout): a client's own
// revenue is a different Stripe account than NBC's billing account.
export function stripeConfigured(): boolean {
  return Boolean(process.env.TRACKER_STRIPE_SECRET_KEY);
}

export async function fetchStripeSnapshot(_range: TrackerRange): Promise<TrackerSnapshot> {
  if (!stripeConfigured()) throw new IntegrationError(503, "Stripe has not been configured yet.");
  throw new IntegrationError(503, "Stripe connector is not implemented yet.");
}
