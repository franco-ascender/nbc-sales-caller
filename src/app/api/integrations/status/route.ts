import { integrationStatus } from "@/services/integration.service";

export async function GET(): Promise<Response> {
  return Response.json(integrationStatus(), { headers: { "Cache-Control": "no-store" } });
}
