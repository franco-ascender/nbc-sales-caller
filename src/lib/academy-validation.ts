import { MAX_MANIFEST_BYTES, parseAcademyManifest } from './academy-manifest.ts';
import type { AcademySave } from './academy-storage-types.ts';

export class AcademyError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, code: string, message: string) { super(message); this.status = status; this.code = code; }
}
export function academyRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
export function academyId(value: string): string {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) throw new AcademyError(400, 'invalid_request', 'A valid inventory ID is required.');
  return value;
}
export function academyInteger(value: string | null, fallback: number, minimum = 0): number {
  if (value === null) return fallback;
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) < minimum || Number(value) > 2147483646) throw new AcademyError(400, 'invalid_request', 'Invalid page or revision.');
  return Number(value);
}
export function parseAcademySave(value: unknown): AcademySave {
  try {
    if (!academyRecord(value) || Object.keys(value).some(k => !['expectedRevision', 'name', 'manifest', 'origin'].includes(k))) throw new Error('Use the documented inventory fields only.');
    if (!Number.isInteger(value.expectedRevision) || Number(value.expectedRevision) < 0 || Number(value.expectedRevision) > 2147483646) throw new Error('An expected revision is required.');
    if (typeof value.name !== 'string' || !value.name.trim() || value.name.trim().length > 160) throw new Error('Inventory name must contain 1–160 characters.');
    if (!academyRecord(value.origin) || Object.keys(value.origin).some(k => !['label', 'url'].includes(k)) || typeof value.origin.label !== 'string' || !value.origin.label.trim() || value.origin.label.trim().length > 160) throw new Error('Provide an origin label of 1–160 characters.');
    let url: string | undefined;
    if (value.origin.url !== undefined) {
      if (typeof value.origin.url !== 'string' || value.origin.url.length > 2048 || !value.origin.url.startsWith('https://')) throw new Error('Origin must be an HTTPS reference.');
      const parsed = new URL(value.origin.url);
      if (parsed.username || parsed.password || parsed.protocol !== 'https:' || !parsed.hostname) throw new Error('Origin cannot include credentials.');
      url = parsed.href;
    }
    return { expectedRevision: Number(value.expectedRevision), name: value.name.trim(), manifest: parseAcademyManifest(JSON.stringify(value.manifest)), origin: { label: value.origin.label.trim(), ...(url ? { url } : {}) } };
  } catch (error) { throw new AcademyError(400, 'invalid_request', error instanceof Error && error.name !== 'TypeError' ? error.message : 'Invalid inventory metadata.'); }
}
export async function readAcademyJson(request: Request): Promise<unknown> {
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') throw new AcademyError(415, 'unsupported_media_type', 'Use application/json.');
  const reader = request.body?.getReader();
  if (!reader) throw new AcademyError(400, 'invalid_request', 'A JSON body is required.');
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const result = await reader.read(); if (result.done) break;
      size += result.value.byteLength;
      if (size > MAX_MANIFEST_BYTES + 16384) { await reader.cancel(); throw new AcademyError(413, 'payload_too_large', 'Inventory request is too large.'); }
      chunks.push(result.value);
    }
    const bytes = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as unknown;
  } catch (error) { if (error instanceof AcademyError) throw error; throw new AcademyError(400, 'invalid_request', 'The JSON body could not be read.'); }
  finally { reader.releaseLock(); }
}
export function academyDatabaseError(error: { code?: string }): AcademyError {
  if (error.code === 'PT404') return new AcademyError(404, 'not_found', 'Inventory not found.');
  if (error.code === 'PT409' || error.code === '23505') return new AcademyError(409, 'revision_conflict', 'A newer revision exists. Your draft is preserved. Export it or open the saved revision before saving again.');
  if (['42P01', '42883', 'PGRST202', 'PGRST205'].includes(error.code ?? '')) return new AcademyError(503, 'storage_pending', 'Academy storage is pending setup. Keep your draft and export it.');
  return new AcademyError(503, 'storage_unavailable', 'Academy storage could not be reached. Your draft is preserved; retry reading before saving again.');
}
