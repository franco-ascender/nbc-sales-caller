import 'server-only';
import { database, IntegrationError } from './integration.service';
import { AcademyError, academyDatabaseError, academyId, parseAcademySave } from '../lib/academy-validation.ts';
import type { AcademyDocument, AcademyPage, AcademyRevisionPage, AcademySummary } from '../lib/academy-storage-types.ts';
import type { SupabaseClient } from '@supabase/supabase-js';

const PAGE_SIZE = 20;
function storage(): SupabaseClient {
  try { return database(); } catch { throw new AcademyError(503, 'storage_pending', 'Academy storage is pending setup. Keep your draft and export it.'); }
}
interface HeadRow { id: string; name: string; revision: number; created_at: string; updated_at: string }
function summary(row: HeadRow): AcademySummary { return { id: row.id, name: row.name, revision: row.revision, createdAt: row.created_at, updatedAt: row.updated_at }; }
export async function listAcademyInventories(owner: string, offset: number, db = storage()): Promise<AcademyPage> {
  const { data, error } = await db.from('academy_inventories').select('id,name,revision,created_at,updated_at').eq('owner_id', owner).order('created_at', { ascending: false }).order('id', { ascending: false }).range(offset, offset + PAGE_SIZE);
  if (error) throw academyDatabaseError(error);
  return { inventories: (data ?? []).slice(0, PAGE_SIZE).map(summary), nextOffset: (data?.length ?? 0) > PAGE_SIZE ? offset + PAGE_SIZE : null };
}
export async function getAcademyInventory(owner: string, id: string, revision?: number, db = storage()): Promise<AcademyDocument> {
  academyId(id);
  const { data: head, error } = await db.from('academy_inventories').select('id,name,revision,created_at,updated_at').eq('id', id).eq('owner_id', owner).maybeSingle();
  if (error) throw academyDatabaseError(error);
  if (!head) throw new AcademyError(404, 'not_found', 'Inventory not found.');
  const { data: snapshot, error: snapshotError } = await db.from('academy_revisions').select('name,revision,manifest,origin,created_at').eq('inventory_id', id).eq('owner_id', owner).eq('revision', revision ?? head.revision).maybeSingle();
  if (snapshotError) throw academyDatabaseError(snapshotError);
  if (!snapshot) throw new AcademyError(404, 'not_found', 'Inventory revision not found.');
  return { ...summary(head), name: snapshot.name, revision: snapshot.revision, updatedAt: snapshot.created_at, manifest: snapshot.manifest, origin: snapshot.origin };
}
export async function listAcademyRevisions(owner: string, id: string, offset: number, db = storage()): Promise<AcademyRevisionPage> {
  academyId(id);
  const { data: head, error: headError } = await db.from('academy_inventories').select('id').eq('id', id).eq('owner_id', owner).maybeSingle();
  if (headError) throw academyDatabaseError(headError);
  if (!head) throw new AcademyError(404, 'not_found', 'Inventory not found.');
  const { data, error } = await db.from('academy_revisions').select('revision,name,created_at').eq('inventory_id', id).eq('owner_id', owner).order('revision', { ascending: false }).range(offset, offset + PAGE_SIZE);
  if (error) throw academyDatabaseError(error);
  return { revisions: (data ?? []).slice(0, PAGE_SIZE).map(row => ({ revision: row.revision, name: row.name, createdAt: row.created_at })), nextOffset: (data?.length ?? 0) > PAGE_SIZE ? offset + PAGE_SIZE : null };
}
export async function saveAcademyInventory(owner: string, id: string, input: unknown, db = storage()): Promise<AcademyDocument> {
  academyId(id);
  const save = parseAcademySave(input);
  const { data, error } = await db.rpc('academy_save_inventory', { p_id: id, p_owner: owner, p_expected: save.expectedRevision, p_name: save.name, p_manifest: save.manifest, p_origin: save.origin });
  if (error) throw academyDatabaseError(error);
  if (!data || data.id !== id || data.revision !== save.expectedRevision + 1) throw new AcademyError(503, 'storage_unavailable', 'Save could not be verified. Keep your draft and read the saved inventory before retrying.');
  return data as AcademyDocument;
}
export function academyResponse(body: unknown, status = 200): Response { return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } }); }
export function academyApiError(error: unknown): Response {
  if (error instanceof AcademyError) return academyResponse({ error: error.message, code: error.code }, error.status);
  if (error instanceof IntegrationError) return academyResponse({ error: error.message, code: 'operator_access' }, error.status);
  return academyResponse({ error: 'The Academy request could not be completed. Keep your draft and try again.', code: 'request_failed' }, 500);
}
