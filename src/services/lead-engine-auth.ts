import 'server-only';
import { database, IntegrationError, requireOperator } from './integration.service';

// Research remains internal to the configured operator. A valid Auth token alone
// must not bypass a suspension or role change made in Members.
export async function requireLeadOperator(request: Request): Promise<string> {
  const id = await requireOperator(request);
  const membership = await database().from('nbc_members')
    .select('id,role,status').eq('id', id).maybeSingle();
  if (membership.error) {
    throw new IntegrationError(503, 'Lead Engine access could not be checked. Please try again.');
  }
  if (!membership.data || membership.data.id !== id ||
      membership.data.status !== 'active' || membership.data.role !== 'admin') {
    throw new IntegrationError(403, 'Active administrator access is required to use the internal Lead Engine.');
  }
  return id;
}
