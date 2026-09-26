import 'server-only';
import { database, IntegrationError } from './integration.service';
import { createBatchDataVerificationProvider } from './lead-engine-batchdata';
import { excludeBeforeVerification } from '@/lib/run-review';
import { PILOT_ROUND, type PilotRow } from '@/lib/live-pilot';

// One number per explicit browser request. The UI continues only while the user-started action is open.
// The claim lives before POST. A lost response cannot release the claim or pay for the same phone again.
export async function verifyRunPhone(owner: string, key: string): Promise<void> {
  const db = database();
  const { data: round, error } = await db.from('nbc_pilot_rounds').select('settings').eq('id', PILOT_ROUND).eq('owner_id', owner).maybeSingle();
  if (error || !round) throw new IntegrationError(403, 'This run is not assigned to your account.');
  const pricing = round.settings?.verification;
  if (!process.env.BATCHDATA_API_KEY || !pricing || pricing.provider !== 'batchdata' || !Number.isSafeInteger(pricing.unitCents) || pricing.unitCents < 1 || pricing.unitCents > 10 || !(Date.parse(pricing.confirmedAt) > Date.now() - 30 * 86400000) || Date.parse(pricing.confirmedAt) > Date.now()) throw new IntegrationError(409, 'Phone verification needs a confirmed account rate before any number can be charged.');
  const [{ data: operation, error: operationError }, { data: checks, error: checkError }] = await Promise.all([
    db.from('nbc_pilot_operations').select('result,state').eq('round_id', PILOT_ROUND).eq('key', key).maybeSingle(),
    db.from('nbc_pilot_phone_checks').select('phone10,state').eq('round_id', PILOT_ROUND),
  ]);
  if (operationError || checkError) throw new IntegrationError(503, 'Saved verification progress could not be read.');
  if (!operation || operation.state !== 'completed' || !Array.isArray(operation.result.rows)) throw new IntegrationError(409, 'Complete business discovery before phone verification.');
  const checked = new Set((checks ?? []).map(c => c.phone10));
  const row = (operation.result.rows as PilotRow[]).find(r => !excludeBeforeVerification(r) && r.phone10 && !checked.has(r.phone10));
  if (!row?.phone10) return;
  const { data: claim, error: claimError } = await db.rpc('nbc_pilot_claim_phone', { p_owner: owner, p_key: key, p_phone: row.phone10 });
  if (claimError) throw new IntegrationError(409, claimError.message.includes('budget') ? 'The remaining approved allocation cannot cover another verification.' : 'Another operation is active or needs reconciliation. No new verification started.');
  if (!claim.acquired) return;
  try {
    const [verification] = await createBatchDataVerificationProvider(process.env.BATCHDATA_API_KEY).verifyPhones([row.phone10]);
    if (!verification || verification.phone10 !== row.phone10) throw Error('Verification mismatch');
    const saved = await db.rpc('nbc_pilot_finish_phone', { p_owner: owner, p_phone: row.phone10, p_verification: verification });
    if (saved.error) throw Error('Verification receipt not saved');
  } catch {
    await db.rpc('nbc_pilot_finish_phone', { p_owner: owner, p_phone: row.phone10, p_verification: null });
    throw new IntegrationError(503, 'This verification could not be confirmed. Its reservation is retained; it will not be retried automatically.');
  }
}
