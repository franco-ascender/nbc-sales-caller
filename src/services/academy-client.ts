import { AcademyError } from '../lib/academy-validation.ts';
import type { AcademyDocument, AcademyPage, AcademySave, AcademyRevisionPage } from '../lib/academy-storage-types.ts';
export async function academyRequest<T>(path: string, token: string, options?: RequestInit): Promise<T> {
  let response: Response;
  try { response = await fetch(`/api/academy/inventories${path}`, { ...options, headers: { Authorization: `Bearer ${token}`, ...(options?.body ? { 'Content-Type': 'application/json' } : {}) }, cache: 'no-store', signal: AbortSignal.timeout(15000) }); }
  catch { throw new AcademyError(503, 'network_error', 'Academy could not be reached. Your draft is preserved. Read the saved inventory before retrying a save.'); }
  let payload: T & { error?: string; code?: string };
  try { payload = await response.json() as typeof payload; } catch { throw new AcademyError(503, 'invalid_response', 'Academy returned an unreadable response. Keep your draft and retry reading.'); }
  if (!response.ok) throw new AcademyError(response.status, payload.code ?? 'request_failed', payload.error ?? 'Academy request failed. Your draft is preserved.');
  return payload;
}
export const academyClient = {
  list: (token: string, offset = 0): Promise<AcademyPage> => academyRequest(`?offset=${offset}`, token),
  read: async (token: string, id: string, revision?: number): Promise<AcademyDocument> => (await academyRequest<{ inventory: AcademyDocument }>(`/${id}${revision ? `?revision=${revision}` : ''}`, token)).inventory,
  revisions: (token: string, id: string, offset = 0): Promise<AcademyRevisionPage> => academyRequest(`/${id}/revisions?offset=${offset}`, token),
  save: async (token: string, id: string, save: AcademySave): Promise<AcademyDocument> => (await academyRequest<{ inventory: AcademyDocument }>(`/${id}`, token, { method: 'PUT', body: JSON.stringify(save) })).inventory,
};
