import { apiError } from "@/services/integration.service";
import { processElevenLabsPostCall } from "@/services/caller-webhook.service";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  try {
    return Response.json(await processElevenLabsPostCall(request));
  } catch (error) {
    return apiError(error);
  }
}
