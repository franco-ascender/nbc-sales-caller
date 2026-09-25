import { MemberError } from "@/lib/member-validation";
import { mutateMemberWorkspace, readMemberWorkspace, requireMember } from "@/services/member-workspace";

function reply(body: unknown, status = 200): Response { return Response.json(body, { status, headers: { "Cache-Control": "no-store" } }); }
function failure(error: unknown): Response { return error instanceof MemberError ? reply({ error: error.message }, error.status) : reply({ error: "Your workspace could not be reached. Please try again." }, 500); }
export async function GET(request: Request): Promise<Response> {
  try { return reply(await readMemberWorkspace(await requireMember(request), request)); } catch (error) { return failure(error); }
}
export async function POST(request: Request): Promise<Response> {
  try {
    const actor = await requireMember(request);
    if (!request.headers.get("content-type")?.includes("application/json")) throw new MemberError(415, "Use application/json.");
    const reader = request.body?.getReader(); if (!reader) throw new MemberError(400, "Request body is required.");
    const chunks: Uint8Array[] = []; let size = 0;
    try { while (true) { const result = await reader.read(); if (result.done) break; size += result.value.byteLength; if (size > 8192) { await reader.cancel(); throw new MemberError(413, "Your request is too large."); } chunks.push(result.value); } } finally { reader.releaseLock(); }
    let body: unknown; try { body = JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { throw new MemberError(400, "Use valid JSON."); }
    await mutateMemberWorkspace(actor, body); return reply({ saved: true });
  } catch (error) { return failure(error); }
}
