// Operator-only approved pilot. --preflight is read-only. --start dispatches ONCE.
// --sync only reads the reserved run; it never starts/restarts an Actor or verifies phones.
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { randomUUID } from 'node:crypto';
import { openPilotBudget } from './lib/live-pilot-budget.mjs';
import { createApifyDiscoveryProvider } from '../src/services/lead-engine-apify.ts';
import { parseDiscoveryObservation } from '../src/lib/lead-engine-discovery.ts';
import { parseDiscoveryCandidate } from '../src/lib/lead-engine-scrape.ts';
import { isChain } from '../src/lib/lead-engine-brands.ts';

const mode = process.argv[2] ?? '--preflight';
if (!['--init', '--preflight', '--start', '--sync', '--report'].includes(mode) || process.argv.length > 3) throw Error('Use --init, --preflight, --start, --sync or --report.');
// Latest user instruction: paid tests must be initiated by the user in the portal.
if (mode === '--start') throw Error('CLI scraping disabled. The user must start tests from the portal.');
const e = parseEnv(readFileSync('.env.local', 'utf8'));
const path = 'config/first-live-tests.local.sqlite';
const op = 'roofing-miami:discovery';
const actorId = 'nwua9Gu5YrADL7ZDj', build = '0.14.757';
const directory = 'artifacts/readiness/first-live-tests';
const headers = { Authorization: `Bearer ${e.APIFY_API_TOKEN}` };
async function get(route) {
  const response = await fetch(`https://api.apify.com/v2/${route}`, { headers, redirect: 'error', signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw Error(`Apify read failed (${response.status}).`);
  return response.json();
}
async function preflight() {
  if (!e.APIFY_API_TOKEN) throw Error('Apify access missing.');
  const [actor, me, limits, pinned] = await Promise.all([
    get(`acts/${actorId}`), get('users/me'), get('users/me/limits'), get(`acts/${actorId}/builds?limit=30&desc=true`),
  ]);
  const active = actor.data.pricingInfos.filter(row => Date.parse(row.startedAt) <= Date.now()).sort((a, b) => Date.parse(a.startedAt) - Date.parse(b.startedAt)).at(-1);
  const tier = me.data.plan?.id;
  const events = active?.pricingPerEvent?.actorChargeEvents ?? {};
  const rate = events['place-scraped']?.eventTieredPricingUsd?.[tier]?.tieredEventPriceUsd ?? events['place-scraped']?.eventPriceUsd;
  const available = limits.data.limits.maxMonthlyUsageUsd - limits.data.current.monthlyUsageUsd;
  if (active?.pricingModel !== 'PAY_PER_EVENT' || !(rate > 0 && rate <= .004)
    || (active.minimalMaxTotalChargeUsd ?? 0) > .5 || available < .75
    || !pinned.data.items.some(row => row.status === 'SUCCEEDED' && row.buildNumber === build)) throw Error('Pricing, pinned build or available funds do not fit the approved pilot.');
  return { provider: 'apify', actorId, build, tier, perPlaceUsd: rate, availableUsd: available,
    activeRuns: limits.data.current.activeActorJobCount, providerCapUsd: .5, reservedUsd: .75,
    maxPlacesRequested: 50, location: 'Miami, Florida, United States', extras: false, checkedAt: new Date().toISOString() };
}
const write = (name, body) => { mkdirSync(directory, { recursive: true, mode: 0o700 }); writeFileSync(`${directory}/${name}.json`, JSON.stringify(body, null, 2) + '\n', { mode: 0o600 }); };
if (mode === '--preflight') {
  console.log(JSON.stringify(await preflight(), null, 2));
} else {
  const budget = openPilotBudget(path, { initialize: mode === '--init' });
  try {
    if (mode === '--start') {
      if (budget.get(op)) throw Error('Pilot already reserved. Use --sync; never start again.');
      const pricing = await preflight();
      if (pricing.activeRuns !== 0) throw Error('Another Apify run is active. Wait before this pilot.');
      const job = { batchId: randomUUID(), planId: randomUUID(), operatorId: randomUUID(), actorId, build,
        searchTerm: 'roofing contractor', location: pricing.location, maxResults: 50, maxCostCents: 50,
        status: 'dispatching', runId: null, datasetId: null };
      write('roofing-miami-preflight', pricing);
      budget.reserve(op, 'roofing-miami', 'apify', 75); // 50c Actor ceiling + read/rounding contingency.
      budget.observe(op, 'running', { job, pricing });
      try {
        const observed = await createApifyDiscoveryProvider(e.APIFY_API_TOKEN).start(job);
        budget.observe(op, 'running', { job: { ...job, ...observed }, pricing });
        console.log(JSON.stringify({ started: true, status: observed.status, budget: budget.summary() }, null, 2));
      } catch {
        budget.observe(op, 'uncertain', { job, pricing });
        throw Error('Start not confirmed. Reservation retained; reconcile at Apify. No retry is permitted.');
      }
    } else if (mode === '--sync') {
      const operation = budget.get(op), job = operation?.receipt?.job;
      if (!job?.runId) throw Error('No confirmed run ID. No new dispatch will be attempted.');
      const payload = await get(`actor-runs/${job.runId}`);
      const observed = parseDiscoveryObservation(payload, job);
      write('roofing-miami-run', payload.data);
      if (observed.status === 'running') console.log(JSON.stringify({ status: 'running', budget: budget.summary() }));
      else {
        const run = payload.data;
        if (typeof run.usageTotalUsd !== 'number' || run.usageTotalUsd < 0 || run.usageTotalUsd > .5 + 1e-9) throw Error('Run cost not reconciled within provider cap.');
        const rows = await get(`datasets/${observed.datasetId}/items?format=json&limit=150&clean=true`);
        if (!Array.isArray(rows) || rows.length > 125) throw Error('Unexpected pilot dataset. Review manually.');
        write('roofing-miami-raw', rows);
        const plan = { industry: 'roofing', metro: 'Miami, FL', target: 50, hardBudgetCents: 200, exclusions: [] };
        const seen = new Set();
        const reviewed = rows.map(row => {
          const parsed = parseDiscoveryCandidate(row, plan);
          const duplicate = seen.has(parsed.businessKey); seen.add(parsed.businessKey);
          return { ...parsed, duplicate, chain: isChain(parsed.name, 'roofing'), phoneValidation: 'not_run', ownerIdentity: 'not_confirmed' };
        });
        write('roofing-miami-reviewed', reviewed);
        const report = { stage: 'discovery_only', status: observed.status, rawBusinesses: rows.length,
          acceptedForReview: reviewed.filter(row => !row.rejection && !row.duplicate && !row.chain).length,
          withPublishedPhone: reviewed.filter(row => row.phone10).length, withWebsite: reviewed.filter(row => row.website).length,
          duplicateRows: reviewed.filter(row => row.duplicate).length, rejectedRows: reviewed.filter(row => row.rejection || row.chain).length,
          runUsageUsd: run.usageTotalUsd, chargedEvents: run.chargedEventCounts ?? null,
          costScope: 'Actor receipt; dataset-read fees and taxes are not included. Reservation retains contingency.',
          phoneVerification: 'pending_verified_account_rate', ownerIdentityConfirmed: 0, contactsCalled: 0 };
        write('roofing-miami-report', report);
        budget.observe(op, observed.status === 'succeeded' ? 'completed' : 'failed', { ...operation.receipt, report }, run.usageTotalUsd);
        console.log(JSON.stringify({ report, budget: budget.summary() }, null, 2));
      }
    } else console.log(JSON.stringify(budget.summary(), null, 2));
  } finally { budget.close(); }
}
