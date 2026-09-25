import 'server-only';
import { requireWorkspaceUser } from './workspace-auth';
import { IntegrationError } from './integration.service';

export async function requireAcademyAdmin(request: Request): Promise<string> {
  const user = await requireWorkspaceUser(request);
  if (user.role !== 'admin') throw new IntegrationError(403, 'Administrator access is required to manage Academy.');
  return user.id;
}
