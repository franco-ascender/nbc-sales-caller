import "server-only";
import { database, IntegrationError } from "./integration.service";
import type { WorkspaceIdentity } from "@/lib/workspace-types";

export async function requireWorkspaceUser(request: Request): Promise<WorkspaceIdentity> {
  const token = request.headers.get("authorization")?.match(/^Bearer (\S+)$/)?.[1];
  if (!token) throw new IntegrationError(401, "Sign in to your NBC workspace to continue.");
  const db = database();
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user?.email_confirmed_at) throw new IntegrationError(401, "Your session has expired. Sign in again.");
  const membership = await db.from("nbc_members").select("id,display_name,role,status").eq("id", data.user.id).maybeSingle();
  if (membership.error && !["42P01", "PGRST205"].includes(membership.error.code)) throw new IntegrationError(503, "Workspace access could not be checked. Please try again.");
  if (membership.data) {
    if (membership.data.status !== "active" || !["admin", "coach", "student"].includes(membership.data.role)) throw new IntegrationError(403, "Your NBC workspace access is not active.");
    return { id: data.user.id, name: membership.data.display_name, role: membership.data.role, email: data.user.email?.toLowerCase() };
  }
  // Explicit bootstrap for the already-authorized operator while Members is integrated.
  // Existing suspended memberships never reach this fallback.
  const bootstrapEmail = process.env.NBC_OPERATOR_EMAIL?.trim().toLowerCase();
  if (bootstrapEmail && data.user.email?.toLowerCase() === bootstrapEmail) return { id: data.user.id, name: "NBC administrator", role: "admin", email: bootstrapEmail };
  throw new IntegrationError(403, "Your NBC team needs to activate your workspace access.");
}
export async function requireCallerUser(request: Request): Promise<string> { return (await requireWorkspaceUser(request)).id; }
export async function requireWorkspaceAdmin(request: Request): Promise<WorkspaceIdentity> {
  const user = await requireWorkspaceUser(request);
  if (user.role !== "admin") throw new IntegrationError(403, "Administrator access is required to manage voices.");
  return user;
}
