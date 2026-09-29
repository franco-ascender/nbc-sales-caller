import {after} from 'next/server';
import {archiveRecording} from '@/services/caller-archive.service';
import { requireCallerUser } from "@/services/workspace-auth";
import { apiError, IntegrationError } from "@/services/integration.service";
import { syncSession } from "@/services/caller.service";
import { validSessionId } from "@/lib/caller-validation";

export const maxDuration=60;
export async function POST(request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    const operator = await requireCallerUser(request);
    const { id } = await context.params;
    if (!validSessionId(id)) throw new IntegrationError(400, "A valid test session ID is required.");
    const session=await syncSession(operator,id);if(['completed','failed'].includes(session.status))after(async()=>{try{await archiveRecording(operator,'web-'+id);}catch{}});
    return Response.json({ session }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}
