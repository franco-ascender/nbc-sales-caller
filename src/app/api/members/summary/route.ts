import { MemberError } from "@/lib/member-validation";
import { readMemberSummary, requireMember } from "@/services/member-workspace";

export async function GET(request: Request): Promise<Response> {
  try { return Response.json(await readMemberSummary(await requireMember(request)), { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { return Response.json({ error: error instanceof MemberError ? error.message : "Your membership could not be loaded." }, { status: error instanceof MemberError ? error.status : 500, headers: { "Cache-Control": "no-store" } }); }
}
