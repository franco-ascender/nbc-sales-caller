# BUILD SPEC — OWNER CELL ENGINE

**For: Head of AI · Owner: Anas Daoud / NBC Sales** **Status: pipeline proven in production. This document is what to build around it.**

---

## 1\. WHAT WE'RE BUILDING AND WHY

We sell marketing services to small business owners. To sell them, we have to reach them — **the owner, not a receptionist.**

The product is an internal app where an operator picks an industry and gets back **verified owner cell phone numbers**: mobile, live, DNC-scrubbed, deduped against everything we've ever delivered.

**Target industries** span three structurally different problems: home services and trades (roofing, HVAC, concrete), licensed healthcare (dentists, chiropractors, med spas), and online businesses (AI dev shops, SaaS, agencies). **These are not one pipeline. They are three.** Section 4\.

**Two non-negotiables:**

1. **Cost control.** An operator must never be able to accidentally spend $3,000. Every guardrail in section 7 is load-bearing.  
2. **Never buy the same number twice.** Section 6\.

---

## 2\. MEASURED CONSTANTS — USE THESE, DON'T RE-DERIVE THEM

Every figure below came off a real production run. Treat them as the planning baseline; re-measure per industry.

### National build, 272 US metros

|  |  |
| :---- | :---- |
| Businesses scraped | 54,850 |
| On-target after filtering | 38,831 (**70.8%**) |
| Unique numbers verified | 37,918 |
| Mobile | 18,965 (**49.8%**) |
| DNC-flagged, excluded | 8,408 (**44.3% of mobiles**) |
| **Cells delivered** | **10,283** |
| **Yield per business scraped** | **18.7%** |
| Total cost | $469.47 |
| **Cost per cell** | **$0.0457** |

### Per 1,000 businesses scraped

`1,000 → 708 on-target → 691 unique → 346 mobile → 187 callable. $7.84. $0.042/cell.`

### Other measured facts

- **Spanish-language listings have a lower DNC rate:** 36.0% vs 44.3%. Mobile rate similar (47.3%). `language=es` on the scraper surfaces a completely different business set that English queries never return.  
- **Marginal cost per cell:** scraping wider **$0.008** · skip tracing **$0.14**. **18x.**  
- **Verify-after-filter saved 44%** on one batch ($35.85 → $20.20).  
- **Meta Ads Library:** only **3.3%** of businesses actively advertise. The 96.7% who don't are the better pitch.

### NPPES / licensed healthcare — measured on 3,200 chiropractic clinics, 8 states

|  |  |
| :---- | :---- |
| Organization records with an Authorized Official name | **100%** |
| Title reads Owner / President / Doctor / profession | **82%** |
| **AO phone differs from the front-desk phone** | **23%** |

**That 23% is a free gatekeeper bypass.** It is the single highest-value discovery in this project and it costs nothing.

---

## 3\. THE TOOL STACK

| Tool | Role | Cost | Auth |
| :---- | :---- | :---- | :---- |
| **Outscraper** | Google Maps → business, phone, address, website, rating, reviews | First 500 free, **$3/1,000**, drops to $1/1,000 above 100k | `X-API-KEY` header |
| **BatchData** | Line type \+ reachable \+ **DNC \+ TCPA litigator**, one call | **$0.007/record** | `Authorization: Bearer` |
| **NPPES** | Licensed provider registry — names, addresses, Authorized Official | **Free** | none |
| **Datazapp** | Name \+ address → cell. Per MATCH. Telemarketing permitted, free DNC. | **$0.03**, $0.025 @ $1k prepay | account |
| **Apollo** | B2B database — Lane C only | $49–99/mo | API key |
| **Apify** *(optional)* | Contact Details Scraper — phones/emails off business websites | **$1.05/1,000 sites** | API token |

### Endpoints

**Outscraper**

```
GET https://api.outscraper.cloud/maps/search-v3
  header: X-API-KEY
  params: query (repeatable) · limit · async=true · region=US · language (es for Spanish)
  → { results_location } ; poll until status == "Success"
GET https://api.outscraper.cloud/profile/balance
```

Fields used: `name, phone, street, city, state_code, postal_code, website, rating, reviews, category, subtypes, business_status, place_id`

**BatchData**

```
POST https://api.batchdata.com/api/v1/phone/verification
  header: Authorization: Bearer <key>
  body:   {"requests": ["7045551234", ...]}   ≤100 per call
  → results.phoneNumbers[]: { type, dnc, tcpa, reachable, carrier, number }
```

**One call returns all four signals. Do NOT call `/phone/dnc` or `/phone/litigator` separately — you'd be paying twice for data you already have.**

Rate card: verification $0.007 · DNC $0.002 · litigator $0.002 · **skip trace $0.07** · address verification $0.015.

**NPPES** *(free, no key, no rate limit encountered)*

```
GET https://npiregistry.cms.hhs.gov/api/?version=2.1
    &taxonomy_description=Chiropractor&state=FL&limit=200&skip=N
    &enumeration_type=NPI-2
```

Key fields: `basic.authorized_official_first_name / _last_name / _title_or_position / _telephone_number`, `basic.sole_proprietor`, `addresses[]` (LOCATION vs MAILING), `taxonomies[]` Bulk: `download.cms.gov/nppes/NPI_Files.html` — full monthly file, free, no registration. **Ingest the bulk file, don't hammer the API.**

Taxonomy codes (verified live): `1223G0001X` dentist · `1223X0400X` orthodontist · `111N00000X` chiropractor · `152W00000X` optometrist · `225100000X` PT · `207N00000X` dermatology · `363L00000X` NP · `174M00000X` veterinarian.

---

## 4\. THE THREE LANES

### Lane A — owner answers the phone *(trades, home services, auto, personal services)*

```
Outscraper → free filters → BatchData verify → keep Mobile + !dnc + !tcpa + reachable
```

Yield **18.7%** of scraped. **$0.04–0.06/cell.** No appends, no tracing.

### Lane B — front desk answers *(licensed healthcare)*

**Runs name-first. This inverts Lane A.**

```
NPPES (free) → filter to owner-titled AOs → Outscraper overlay for quality signals
  ├─ AO phone ≠ front desk (23%) → BatchData verify → deliver
  └─ remainder → Datazapp append (name+addr) → BatchData verify → deliver
```

**$0.05–0.09/cell projected. Not yet production-validated — pilot before scaling.**

### Lane C — the person isn't the business *(AI dev shops, SaaS, agencies, professionals)*

```
Apollo people search → BatchData verify for DNC/line type → deliver
```

**$0.20–0.50/cell. 20–40% mobile coverage on independent owners.** The app must state this before the operator commits, not after.

### Router

Keyword-match the industry string against three lists. Ambiguous → ask one question: *"Does the owner work hands-on in the field, sit behind a front desk, or work in an office with a LinkedIn profile?"*

---

## 5\. DATA MODEL

```sql
businesses(
  place_id PK, source, name, phone10, street, city, state, zip,
  time_zone,                    -- IANA tz from address, area-code fallback
  website, has_website, rating, reviews, category, subtypes,
  business_status, metro, metro_size, industry, query,
  kept BOOL, drop_reason, fit_tier, first_seen
)
owners(                         -- Lane B
  npi PK, org_name, ao_first, ao_last, ao_title, ao_phone10,
  sole_proprietor, taxonomy, practice_address, matched_place_id
)
verified(
  phone10 PK, line_type, dnc BOOL, tcpa BOOL, reachable BOOL,
  carrier, verified_at
)
delivered(                      -- THE MASTER LEDGER. Global, not per-industry.
  phone10 PK, company, owner_first, owner_last, city, state,
  time_zone, industry, batch_id, delivered_at, source
)
suppression(                    -- GLOBAL AND PERMANENT. Never expires.
  phone10 PK, reason, source_batch_id, added_at
)                               -- opt-outs, complaints, wrong-number, bad-fit
searches_run(query PK, metro, source, run_at, results)
batches(batch_id PK, industry, lane, metros, businesses, cells,
        cost_scrape, cost_verify, cost_append, cost_per_cell, created_at)
```

**`delivered`, `searches_run` and `suppression` are global across every industry.** A general contractor appears in roofing *and* remodeling searches — per-industry ledgers mean paying twice and calling the same owner twice. This already happened once: 8 duplicate numbers reached a list already being dialled.

---

## 6\. THE LEDGER — HARD REQUIREMENTS

1. **Load before every run.** No exceptions.  
2. **`searches_run` prevents repeat scraping** — the expensive mistake.  
3. **`delivered` prevents repeat delivery** — the embarrassing one. 3b. **`suppression` prevents re-contacting someone who asked not to be** — the legally dangerous one. Checked on every build, forever, across every client and industry. Never purged.  
4. **Append only, never overwrite.** One sheet/table per batch.  
5. Source of truth is **Google Drive or Postgres**, never a session workspace.  
6. Persist a `HANDOFF.md` per industry — industry, lane, metros done, metros next, batch number, running totals — so a cold start resumes correctly.

---

## 7\. COST GUARDRAILS — IMPLEMENT AS CODE, NOT AS ADVICE

| \# | Guardrail | Implementation |
| :---- | :---- | :---- |
| 1 | **Pilot before volume** | 300 businesses, hard cap $10. Compute real yield \+ cost/cell. Block scale-up until an operator confirms. |
| 2 | **Ceiling check** | Operator sets a hard $ ceiling. Projected total \> ceiling → **block**, show what the ceiling actually buys. |
| 3 | **Batch cap** | Never queue \>$150 without explicit confirmation. |
| 4 | **Stop-loss** | Cost/cell in any batch \> $0.15 → halt, report, require confirmation. |
| 5 | **Skip trace OFF by default** | Only Lane B, only with a registry-verified name, never silently. |
| 6 | **Filter before verify** | Relevance filter runs *before* the paid call. Worth 44%. |
| 7 | **Pre-flight balance check** | Both APIs, before every run. Outscraper `/profile/balance`; BatchData a 2-number test call. |
| 8 | **Parse error bodies** | Outscraper dry \= **402**. BatchData dry \= **403 \+ `"Insufficient balance"` in the body.** Never infer from the status code alone — that misread cost a full day. |

---

## 8\. QUALITY GATES — BLOCK DELIVERY ON ANY FAILURE

```
✓ row counts match the summary
✓ zero duplicate phone10 inside the file
✓ zero intersection with `delivered`
✓ zero intersection with `suppression`
✓ every row has a `time_zone` consistent with its state
✓ zero rows where line_type != 'Mobile' OR dnc OR tcpa OR !reachable
✓ DNC exclusion rate between 15% and 60% of mobiles   ← 0% or 100% = broken filter
✓ top tab ⊆ full tab
✓ every phone exactly 10 digits, every row has a company name
✓ operator-requested exclusions return zero rows
✓ 5 random rows spot-checked against live Google listings
```

### Two filter rules that are not optional

**Positive relevance allowlist.** A row must positively match the trade by category, subcategory, or name. A blocklist alone is insufficient — a New York restaurant and a Vermont schooner charter both reached a contractor list through blocklist-only filtering.

**Sort by fit, then reviews.** Review-count-first sorting puts the *least* on-target rows at the top, because off-niche businesses often have the largest review counts. Tag Core / Adjacent / General and sort within tier.

---

## 9\. THE APP

**Input:** industry · country/region · target cells · hard $ ceiling · exclusions.

**Screen 1 — Plan.** Router assigns the lane. Show expected yield, cost/cell, projected total, and a **red block if it exceeds the ceiling**. Nothing spends yet.

**Screen 2 — Pilot.** One click, $10 cap. Show real yield vs projected, 20 sample rows, and a recomputed projection. Scale-up button stays disabled until the operator approves.

**Screen 3 — Run.** Live progress: scraped / filtered / verified / delivered, running spend, cost per cell, both balances. Stop-loss visible and armed.

**Screen 4 — Deliver.** xlsx \+ CSV, quality gates shown as a pass/fail checklist, ledger written.

**Output columns** `# | Company | Owner First | Owner Last | Cell Phone | Email | Website | Has Website | City | State | Rating | Reviews | Franchise | Fit | Source | Owner Match | Alt Cells | Metro | Running Meta Ads`

**Never emit a landline or VoIP number anywhere.**

### Two free columns worth more than they cost

- **Has Website: No** — a business with strong reviews and no website is the warmest possible prospect for a marketing agency. Surface it, don't bury it.  
- **Running Meta Ads** — Ads Library search link on every row. For a real Yes/No, match on the **advertiser page name**, not ad text; the API is a keyword search and raw results are mostly unrelated advertisers. "No" means *not found*, not *doesn't advertise*.

---

## 10\. TESTED AND REJECTED — DO NOT RE-RESEARCH

| Tool | Verdict |
| :---- | :---- |
| Shovels | $599/mo floor. No $99 tier exists. No edge over Google Maps. |
| Twilio Lookup | $0.008, line type only. BatchData does more for $0.007. |
| Clay | Only pays off at 5,000+/mo across many niches. |
| FastAppend | $200 minimum. |
| Lusha / RocketReach / ContactOut / Seamless | LinkedIn-derived. 20–40% coverage on independent owners. |
| **Tracers / TLOxp / idiCORE** | **Terms prohibit marketing use. Credentialing will fail. Hard no.** |
| Tracerfy | Measured **$0.137/cell** — 3x the scrape path. No named data sources, no independent coverage. Unvetted reseller profile. |
| BrightLocal / Yext / Uberall | Per-managed-location pricing. 10,000 businesses ≈ **$90k/month**. |
| WHOIS | 10.8% real registrants post-GDPR. Dead. |
| Practice-for-sale broker listings | Deliberately anonymized. Yields nothing. |
| Apify *(for Maps)* | $3/1,000 — identical to Outscraper, more setup. **Its Contact Details Scraper at $1.05/1,000 sites is the only part worth using.** |
| Google Places API | Same source we already scrape. Stale in, stale out. |

---

## 11\. COMPLIANCE — ENGINEERING REQUIREMENTS

**The only channel is manual outbound calling.** Every requirement below serves that.

1. **Every delivered number carries a `dnc_checked_at` timestamp.** The app must flag any list older than **31 days** as requiring re-scrub, and should refuse to export a stale list without an explicit override.  
2. **Every delivered row carries a `time_zone`**, derived from the business address with an area-code fallback. This is a hard schema requirement, not a nice-to-have: the legal calling window is 8:00am–9:00pm in the **recipient's** local time, and the operator is in Eastern. Without this column the app is shipping a compliance trap. Default sort within each fit tier: **time zone east → west.**  
3. **Never emit a landline or VoIP number.** Enforce at the query layer, not the export layer.  
4. **`tcpa` litigator flag is excluded at build time**, not surfaced as a warning for a human to override.  
5. **Ship a Legal Notes tab on every file:** manual dialing only · no autodialer, predictive dialer, prerecorded message or ringless voicemail · 8am–9pm recipient local time · identify yourself and your company on the call · internal DNC list · honour opt-outs immediately and permanently across all future lists · two-party call-recording consent follows the *recipient's* state · state laws vary.  
6. **Suppression list is global and permanent.** An opt-out captured on one campaign must suppress that number on every future build for every client, across industries. This is a first-class table, not a per-job CSV — see §5. Getting this wrong is the failure mode that survives a lawyer's review of any single list and still sinks you.  
7. **Export the empty caller-workflow columns** (`called`, `outcome`, `notes`) formatted as text, so the delivered file is usable as a dial sheet without being rebuilt.  
8. **No SMS export path.** The business does not cold-text. Texting happens only to inbound leads who opted in through an ad or texted first, and those live in the CRM, not here. Do not build an SMS export, and do not add a "send to SMS platform" integration — the moment one exists, someone will point it at a scraped list.

---

## 12\. WHAT'S STILL UNPROVEN — MEASURE BEFORE TRUSTING

| Assumption | Status |
| :---- | :---- |
| Lane A at **$0.046/cell** | ✅ **Production-validated**, 10,283 cells |
| Lane B (NPPES → Datazapp) at $0.05–0.09 | ⚠️ Components verified, **full pipeline never run end to end** |
| Lane C at $0.20–0.50 | ⚠️ **Estimated from vendor pricing, never run.** Pilot before quoting it to anyone |
| Datazapp append match rate \~45% | ⚠️ Vendor claim \+ third-party ranges, not our measurement |
| Website cross-reference layer | ⚠️ Designed, not built. \~55–60% confirmation expected, 2–4% surface a newer number. **Watch for call-tracking numbers (CallRail, Podium) producing false mismatches** |
| Tier 2 mobile rate 20–30% | ⚠️ Structural inference, not measured |

**Rule: nothing gets quoted to a client as a price until it has been piloted at 300 records.**

---

## 13\. BUILD ORDER

1. **Ledger \+ data model first.** Everything else depends on dedupe working.  
2. **Lane A end to end** — it's proven and it's 80% of demand.  
3. **Guardrails as code** — pilot gate, ceiling block, stop-loss, balance pre-flight.  
4. **Quality gates as blocking checks** — a failed gate must prevent delivery, not warn.  
5. **Lane B** — NPPES ingest, AO filter, Datazapp. Pilot on chiropractors; the data is strongest there.  
6. **Lane C** — Apollo, last. Lowest ROI, highest cost, most caveats.  
7. Optional: website enrichment (Apify Contact Details Scraper) for the has-website signal and phone cross-reference.

