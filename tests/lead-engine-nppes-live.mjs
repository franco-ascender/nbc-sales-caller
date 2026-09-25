// Live network check against the real, public NPPES registry (no key). Not part of `npm test`
// (only tests/*.test.ts run there) — run manually: node --experimental-strip-types tests/lead-engine-nppes-live.mjs
// Evidence of a real, working discovery call end to end, ahead of any Apify/Outscraper account.
import { writeFileSync, mkdirSync } from 'node:fs';
import { createNppesDiscoveryProvider } from '../src/services/lead-engine-nppes.ts';

const provider = createNppesDiscoveryProvider();
const query = { taxonomyDescription: 'Chiropractor', state: 'NC', limit: 5, skip: 0 };
const page = await provider.search(query);

mkdirSync('artifacts/lanes/L03', { recursive: true });
writeFileSync('artifacts/lanes/L03/nppes-live-check.json', JSON.stringify({ checkedAt: new Date().toISOString(), query, page }, null, 2));

console.log(`NPPES live check: ${page.rows.length} of ${page.resultCount} total for ${query.taxonomyDescription} in ${query.state}`);
for (const row of page.rows) {
  console.log(`- NPI ${row.npi} | ${row.organizationName ?? 'unknown org'} | AO ${row.authorizedOfficialFirstName ?? '?'} ${row.authorizedOfficialLastName ?? '?'}`
    + ` | AO phone ${row.authorizedOfficialPhone10 ?? 'none'} | front-desk ${row.locationPhone10 ?? 'none'} | differs=${row.ownerPhoneDiffersFromFrontDesk}`);
}
if (page.rows.length === 0) throw new Error('Live check returned zero rows; do not treat this as a working pipeline.');
