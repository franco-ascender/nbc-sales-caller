import type { SupabaseClient } from '@supabase/supabase-js';
import { LeadEngineError } from '../lib/lead-engine-storage.ts';
import { isValidEdge, neighborhoodFromEdges, NODE_TYPES } from '../lib/lead-engine-graph.ts';
import type { GraphEdge, NodeType, PhoneNeighborhood } from '../lib/lead-engine-graph.ts';

// Phase 5 task 2: writes to lead_engine_entity_graph_edges and the phone neighborhood read. Edges are
// append-only (immutable trigger); duplicates within a day are ignored through the unique index added
// in migration 202609210270 (from, to, relation, source, observed_day). The read goes through the SQL
// function lead_engine_phone_neighborhood so the two hops happen in one round trip.

const PHONE10 = /^[2-9][0-9]{2}[2-9][0-9]{6}$/;
const CHUNK = 500;

function storageError(error: { code?: string; message?: string }, fallback: string): LeadEngineError {
  if (['42P01', '42883', 'PGRST202', 'PGRST205'].includes(error.code ?? '')) return new LeadEngineError(503, 'storage_pending', 'The entity graph tables are not applied to this database yet.');
  return new LeadEngineError(503, 'storage_pending', fallback);
}

export interface WriteEdgesResult { attempted: number; skippedInvalid: number }
export async function writeEdges(db: SupabaseClient, edges: readonly GraphEdge[]): Promise<WriteEdgesResult> {
  const valid = edges.filter(isValidEdge);
  for (let offset = 0; offset < valid.length; offset += CHUNK) {
    const chunk = valid.slice(offset, offset + CHUNK).map(item => ({ ...item, payload: item.payload ?? null }));
    const result = await db.from('lead_engine_entity_graph_edges').upsert(chunk, { onConflict: 'from_type,from_id,to_type,to_id,relation,source,observed_day', ignoreDuplicates: true });
    if (result.error) throw storageError(result.error, 'The graph edges could not be written. Nothing else changed.');
  }
  return { attempted: valid.length, skippedInvalid: edges.length - valid.length };
}

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
function parseEdge(value: unknown): GraphEdge | null {
  if (!record(value)) return null;
  const from = String(value.from_type ?? ''), to = String(value.to_type ?? '');
  if (!NODE_TYPES.includes(from as NodeType) || !NODE_TYPES.includes(to as NodeType)) return null;
  const built: GraphEdge = {
    from_type: from as NodeType, from_id: String(value.from_id ?? ''), to_type: to as NodeType, to_id: String(value.to_id ?? ''),
    relation: String(value.relation ?? ''), source: String(value.source ?? ''), observed_at: String(value.observed_at ?? ''), payload: record(value.payload) ? value.payload : null,
  };
  return isValidEdge(built) ? built : null;
}

export async function phoneNeighborhood(db: SupabaseClient, phone10: string): Promise<PhoneNeighborhood> {
  if (!PHONE10.test(phone10)) throw new LeadEngineError(400, 'invalid_input', 'A ten digit US phone number is required.');
  const { data, error } = await db.rpc('lead_engine_phone_neighborhood', { p_phone: phone10 });
  if (error) throw storageError(error, 'The phone neighborhood could not be read.');
  const edges = (Array.isArray(data) ? data : []).map(parseEdge).filter((item): item is GraphEdge => item !== null);
  return neighborhoodFromEdges(phone10, edges);
}
