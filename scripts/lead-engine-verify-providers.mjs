// Pre-flight provider verification (build spec §7 guardrail 7): read the live rate card and balance
// for every Lead Engine provider using FREE endpoints only, before any run.
//
//   node scripts/lead-engine-verify-providers.mjs           → report only, writes nothing
//   node scripts/lead-engine-verify-providers.mjs --apply   → records the verified rate + balance
//
// It NEVER flips lead_engine_control.execution_enabled. Enabling spend stays a deliberate, separate
// act. It never starts an Actor run, a scrape or a paid phone verification, and never prints a key.
import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { randomUUID } from 'node:crypto';

if (existsSync('.env.local')) loadEnvFile('.env.local');

const APIFY_ACTOR = 'compass~crawler-google-places';
const APPLY = process.argv.includes('--apply');
const usd = value => `USD ${value.toFixed(4).replace(/0+$/, '0')}`;

async function readJson(label, url, headers) {
  try {
    const response = await fetch(url, { headers, redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(15000) });
    if (!response.ok) { console.error(`${label}: provider returned ${response.status}.`); return null; }
    return await response.json();
  } catch (error) {
    console.error(`${label}: request failed (${error instanceof Error ? error.name : 'unknown'}).`);
    return null;
  }
}

async function verifyApify(token) {
  if (!token) return { provider: 'apify', status: 'missing' };
  const auth = { Authorization: `Bearer ${token}`, Accept: 'application/json' };
  const [actor, limits, me] = await Promise.all([
    readJson('apify actor', `https://api.apify.com/v2/acts/${APIFY_ACTOR}`, auth),
    readJson('apify limits', 'https://api.apify.com/v2/users/me/limits', auth),
    readJson('apify account', 'https://api.apify.com/v2/users/me', auth),
  ]);
  if (!actor?.data || !limits?.data || !me?.data) return { provider: 'apify', status: 'unavailable' };
  const tier = me.data.plan?.id ?? 'FREE';
  const pricing = (actor.data.pricingInfos ?? []).at(-1);
  const events = pricing?.pricingPerEvent?.actorChargeEvents ?? {};
  const perPlace = events['place-scraped']?.eventTieredPricingUsd?.[tier]?.tieredEventPriceUsd;
  const perStart = events['apify-actor-start']?.eventPriceUsd ?? 0;
  const build = actor.data.taggedBuilds?.latest?.buildNumber;
  if (typeof perPlace !== 'number' || typeof build !== 'string') return { provider: 'apify', status: 'rate_unreadable' };
  const remaining = Math.max(0, (limits.data.limits?.maxMonthlyUsageUsd ?? 0) - (limits.data.current?.monthlyUsageUsd ?? 0));
  return {
    provider: 'apify', status: 'verified', tier, actorId: actor.data.id, build,
    perPlaceUsd: perPlace, perStartUsd: perStart, balanceUsd: remaining,
    minimalMaxTotalChargeUsd: pricing?.minimalMaxTotalChargeUsd ?? null,
  };
}

async function verifyOutscraper(key) {
  if (!key) return { provider: 'outscraper', status: 'missing' };
  const body = await readJson('outscraper balance', 'https://api.outscraper.cloud/profile/balance', { 'X-API-KEY': key });
  if (!body || typeof body.balance !== 'number') return { provider: 'outscraper', status: 'unavailable' };
  // Published rate; Outscraper exposes no per-request rate endpoint, so this stays documentation-sourced.
  return { provider: 'outscraper', status: 'verified', balanceUsd: body.balance, accountStatus: body.account_status ?? 'unknown', perPlaceUsd: 0.003, rateSource: 'docs/sources/owner-cell-build-spec.md' };
}

async function recordApify(rate) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) { console.error('apply: Supabase URL/secret key are not configured; nothing was written.'); return false; }
  const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' };
  const now = new Date(), until = new Date(now.getTime() + 30 * 86_400_000);
  const evidence = `apify ${APIFY_ACTOR} build ${rate.build} place-scraped ${usd(rate.perPlaceUsd)} tier ${rate.tier}; read live ${now.toISOString().slice(0, 10)}`;
  const pricing = await fetch(new URL('/rest/v1/lead_engine_pricing', url), {
    method: 'POST', headers, body: JSON.stringify({
      id: randomUUID(), actor_id: rate.actorId, build_tag: rate.build,
      base_min_cents: 0, base_max_cents: Math.max(1, Math.ceil(rate.perStartUsd * 100)),
      unit_min_millicents: Math.round(rate.perPlaceUsd * 100_000),
      unit_max_millicents: Math.round(rate.perPlaceUsd * 100_000),
      verified_at: now.toISOString(), valid_until: until.toISOString(), evidence_ref: evidence.slice(0, 300),
    }),
  });
  if (!pricing.ok) { console.error(`apply: pricing insert returned ${pricing.status}.`); return false; }
  const account = await fetch(new URL('/rest/v1/lead_engine_provider_accounts?on_conflict=provider', url), {
    method: 'POST', headers: { ...headers, Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({
      provider: 'apify', balance_cents: Math.floor(rate.balanceUsd * 100), reserved_cents: 0, consumed_cents: 0,
      verified_at: now.toISOString(), valid_until: new Date(now.getTime() + 7 * 86_400_000).toISOString(),
      evidence_ref: `apify ${rate.tier} plan credits remaining ${usd(rate.balanceUsd)}; read live ${now.toISOString().slice(0, 10)}`.slice(0, 300),
    }),
  });
  if (!account.ok) { console.error(`apply: provider account upsert returned ${account.status}.`); return false; }
  return true;
}

const results = await Promise.all([
  verifyApify(process.env.APIFY_API_TOKEN),
  verifyOutscraper(process.env.OUTSCRAPER_API_KEY),
]);
const batchData = process.env.BATCHDATA_API_KEY ? 'configured (no free balance endpoint; a paid 2-number test is the only check)' : 'missing';

console.log('Lead Engine provider pre-flight');
for (const result of results) {
  if (result.status !== 'verified') { console.log(`- ${result.provider}: ${result.status}`); continue; }
  const pilot = result.perPlaceUsd * 300;
  console.log(`- ${result.provider}: balance ${usd(result.balanceUsd)}${result.accountStatus ? ` (${result.accountStatus})` : ''}`
    + `${result.tier ? `, plan ${result.tier}` : ''}, ${usd(result.perPlaceUsd)}/business → 300-business pilot ≈ ${usd(pilot)}`
    + `${result.rateSource ? ` [rate from ${result.rateSource}, not a live rate endpoint]` : ''}`);
  if (result.actorId) console.log(`    actor ${result.actorId} build ${result.build}`
    + (result.minimalMaxTotalChargeUsd ? `, provider requires maxTotalChargeUsd ≥ ${usd(result.minimalMaxTotalChargeUsd)}` : ''));
}
console.log(`- batchdata: ${batchData}`);

const apify = results.find(result => result.provider === 'apify');
if (!APPLY) {
  console.log('\nReport only. Re-run with --apply to record the verified Apify rate and balance.');
  console.log('This check never changes lead_engine_control.execution_enabled.');
} else if (apify?.status !== 'verified') {
  console.error('\napply: Apify rate could not be verified; nothing was written.');
  process.exitCode = 1;
} else if (await recordApify(apify)) {
  console.log('\nRecorded the verified Apify rate and balance. The execution setting was left unchanged.');
} else {
  process.exitCode = 1;
}
