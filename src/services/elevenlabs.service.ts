import "server-only";
import { IntegrationError } from "./integration.service";
import { parseSignedSession } from "@/lib/caller-validation";

export async function elevenRead(path: string): Promise<unknown> {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) throw new IntegrationError(503, "ElevenLabs has not been configured yet.");
  let response: Response;
  try { response = await fetch(new URL(path, "https://api.elevenlabs.io"), { headers: { "xi-api-key": key }, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(15000) }); }
  catch { throw new IntegrationError(502, "The voice provider could not be reached. Check the session history before retrying."); }
  if (!response.ok) throw new IntegrationError(response.status === 404 ? 404 : 502, response.status === 404 ? "The provider has not made this conversation available yet." : "The voice provider rejected the request. Check the API key permissions, agent setup and available credits.");
  return response.json() as Promise<unknown>;
}

export async function elevenQuery(path: string, body: object): Promise<unknown> {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) throw new IntegrationError(503, "ElevenLabs has not been configured yet.");
  let response: Response;
  try { response = await fetch(new URL(path, "https://api.elevenlabs.io"), { method: "POST", headers: { "xi-api-key": key, "Content-Type": "application/json" }, body: JSON.stringify(body), cache: "no-store", redirect: "error", signal: AbortSignal.timeout(15000) }); }
  catch { throw new IntegrationError(502, "Provider usage could not be reached."); }
  if (!response.ok) throw new IntegrationError(502, "Provider usage is temporarily unavailable.");
  try { return await response.json() as unknown; }
  catch { throw new IntegrationError(502, "Provider usage returned an incomplete response."); }
}

export async function createVoiceAuthorization(agentId: string): Promise<{ signedUrl: string; conversationId: string }> {
  const data = await elevenRead(`/v1/convai/conversation/get-signed-url?${new URLSearchParams({ agent_id: agentId, include_conversation_id: "true" })}`);
  try { return parseSignedSession(data); }
  catch { throw new IntegrationError(502, "The voice provider returned an unsupported session authorization."); }
}

// Mutation helper remains private to the server; provider payloads never reach error responses.
export async function elevenWrite(path: string, method: "POST" | "PATCH", body: object | FormData): Promise<unknown> {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) throw new IntegrationError(503, "Voice service setup is incomplete.");
  let response: Response;
  try { response = await fetch(new URL(path, "https://api.elevenlabs.io"), { method, headers: { "xi-api-key": key, ...(body instanceof FormData ? {} : { "Content-Type": "application/json" }) }, body: body instanceof FormData ? body : JSON.stringify(body), cache: "no-store", redirect: "error", signal: AbortSignal.timeout(25000) }); }
  catch { throw new IntegrationError(502, "The voice service did not confirm the change. Check its status before retrying."); }
  if (!response.ok) throw await safeVoiceRejection(response);
  try { return await response.json() as unknown; } catch { throw new IntegrationError(502, "The voice service returned an incomplete confirmation."); }
}

export class ElevenActionError extends IntegrationError {
  constructor(public readonly code: string, message: string, public readonly definite: boolean, status=502) { super(status,message); }
}
export async function safeVoiceRejection(response: Response): Promise<ElevenActionError> {
  let code='';try{const data=await response.json();code=typeof data?.detail?.status==='string'?data.detail.status:'';}catch{/* Only allowlisted codes are retained. */}
  const messages:Record<string,string>={missing_permissions:'The connected key cannot create voices. An administrator needs to enable voice creation permissions.',quota_exceeded:'The connected voice plan has insufficient credits. Review the plan before trying again.',voice_limit_reached:'The connected voice account has no free voice slots. Review existing voices or your plan.',subscription_required:'This action requires a voice plan with this feature enabled.',invalid_audio:'The sample could not be read. Try a clear MP3, WAV, WebM or M4A recording.'};
  const recognized=code in messages?code:response.status===401||response.status===403?'missing_permissions':response.status===402?'subscription_required':response.status===422?'invalid_audio':'provider_rejected';
  return new ElevenActionError(recognized,messages[recognized]||'The voice service rejected this request. Check your plan and permissions before creating another request.',response.status>=400&&response.status<500,response.status===403||response.status===402?403:502);
}
