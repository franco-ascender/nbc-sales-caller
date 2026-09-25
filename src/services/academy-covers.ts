import 'server-only';
import { database } from './integration.service';
import { AcademyError, academyId } from '../lib/academy-validation.ts';
import { validateAcademyCover } from '../lib/academy-cover.ts';
import type { SupabaseClient } from '@supabase/supabase-js';
const BUCKET = 'academy-covers';
function storage(): SupabaseClient {
  try { return database(); } catch { throw pending(); }
}
function pending(): AcademyError { return new AcademyError(503, 'storage_pending', 'Cover storage is pending setup. Your selected image is still available; download it before leaving.'); }
async function privateBucket(db: SupabaseClient): Promise<void> {
  const { data, error } = await db.storage.getBucket(BUCKET);
  if (error || !data || data.public) throw pending();
}
export async function uploadAcademyCover(owner: string, bytes: Uint8Array, db = storage()): Promise<{ coverId: string }> {
  validateAcademyCover(bytes, 'image/jpeg');
  await privateBucket(db);
  const coverId = crypto.randomUUID();
  const { data, error } = await db.storage.from(BUCKET).upload(`${owner}/${coverId}.jpg`, bytes, { contentType: 'image/jpeg', upsert: false, cacheControl: '0' });
  if (error || !data) throw new AcademyError(503, 'storage_unavailable', 'The cover could not be uploaded. Your selected image is preserved; try again.');
  return { coverId };
}
export async function getAcademyCover(owner: string, id: string, db = storage()): Promise<Blob> {
  academyId(id); await privateBucket(db);
  const { data, error } = await db.storage.from(BUCKET).download(`${owner}/${id}.jpg`);
  if (error || !data) throw new AcademyError(404, 'not_found', 'Cover not found.');
  validateAcademyCover(new Uint8Array(await data.arrayBuffer()), 'image/jpeg');
  return data;
}
