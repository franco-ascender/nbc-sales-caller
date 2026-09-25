import { requireWorkspaceAdmin } from "@/services/workspace-auth";
import { apiError, IntegrationError } from "@/services/integration.service";
import { readCallerJson } from "@/services/caller-crm.service";
import { createTextKnowledge, listKnowledgeSources, reserveAudioKnowledge } from "@/services/caller-knowledge.service";
import { parseKnowledgeAudio, parseKnowledgeText } from "@/lib/caller-knowledge";
import { isRecord } from "@/lib/integration-validation";

export async function GET(request: Request): Promise<Response> { try { await requireWorkspaceAdmin(request); return Response.json(await listKnowledgeSources(), { headers: { "Cache-Control": "no-store" } }); } catch (error) { return apiError(error); } }
export async function POST(request: Request): Promise<Response> {
  try {
    const user = await requireWorkspaceAdmin(request), body = await readCallerJson(request, 512 * 1024);
    if (!isRecord(body) || !["text", "audio"].includes(String(body.mode))) throw new IntegrationError(400, "Choose a text or audio knowledge source.");
    let parsed;
    try { parsed = body.mode === "text" ? parseKnowledgeText(body) : parseKnowledgeAudio(body); }
    catch (error) { throw new IntegrationError(400, error instanceof Error ? error.message : "Use a valid knowledge source."); }
    const result = body.mode === "text" ? { source: await createTextKnowledge(user.id, parsed as ReturnType<typeof parseKnowledgeText>) } : await reserveAudioKnowledge(user.id, parsed as ReturnType<typeof parseKnowledgeAudio>);
    return Response.json(result, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}
