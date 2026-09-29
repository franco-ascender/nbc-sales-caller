import 'server-only';
import { database, IntegrationError } from './integration.service';
import { createBatchDataVerificationProvider } from './lead-engine-batchdata';
import { excludeBeforeVerification } from '@/lib/run-review';
import { PILOT_ROUND, type PilotRow } from '@/lib/live-pilot';

// Up to ten numbers per user-started browser step. The UI continues only while the user-started action is open.
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
  const phones = [...new Set((operation.result.rows as PilotRow[]).filter(r => !excludeBeforeVerification(r) && r.phone10 && !checked.has(r.phone10)).map(r => r.phone10!))].slice(0, 10);
  if (!phones.length) return;
  const { data: claim, error: claimError } = await db.rpc('nbc_pilot_claim_phone_batch', { p_owner: owner, p_key: key, p_phones: phones });
  if (claimError) throw new IntegrationError(409, claimError.message.includes('budget') ? 'The remaining approved allocation cannot cover another verification.' : 'Another operation is active or needs reconciliation. No new verification started.');
  if (!claim.acquired) return;
  const claimed: string[] = claim.phones;
  if (!Array.isArray(claimed) || !claimed.length || claimed.length > 10 || new Set(claimed).size !== claimed.length || claimed.some(p => !phones.includes(p))) throw new IntegrationError(503, 'The verification reservation needs reconciliation. No provider request was sent.');
  const unfinished = new Set(claimed);
  try {
    const verifications = await createBatchDataVerificationProvider(process.env.BATCHDATA_API_KEY).verifyPhones(claimed);
    for (const phone of claimed) {
      const verification = verifications.find(v => v.phone10 === phone);
      if (!verification) throw Error('Verification mismatch');
      const saved = await db.rpc('nbc_pilot_finish_phone', { p_owner: owner, p_phone: phone, p_verification: verification });
      if (saved.error) throw Error('Verification receipt not saved');
      unfinished.delete(phone);
    }
  } catch {
    for (const phone of unfinished) await db.rpc('nbc_pilot_finish_phone', { p_owner: owner, p_phone: phone, p_verification: null });
    throw new IntegrationError(503, 'This verification batch could not be fully confirmed. Saved results are retained; unresolved reservations will not be retried automatically.');
  }
}
