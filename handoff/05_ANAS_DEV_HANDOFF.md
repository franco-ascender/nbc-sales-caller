# DEV HANDOFF — Owner Cell App

**Owner: Anas Daoud · Status: brain is built and tested; this is how to
wrap it in the product.** *Replaces the Sept 14 build spec. Everything
measured here came from live runs, Sept 2026.*

## 0. The product in one paragraph

A user signs up, buys **credits**, picks an **industry** and a **state
or "nationwide"**, types **how many numbers**, and clicks Run. Our
backend spends *our* Outscraper and BatchData keys, runs the right
pipeline, and hands back a spreadsheet of **verified owner cell phones**
(mobile, not on DNC, not a litigator) with Google Maps link, rating,
reviews, city, time zone. The user never sees a dollar cost, only
credits. The brain is two files: **brain.json** (routing config —
industry → recipe → steps → expected yield → credits → which states
work; the app loads it) and **engine.py** (the code that executes each
step). You are building the wallet, the queue and the UI around them.
This document explains both.

## 1. The logic, dumbed down (read this before the code)

**One question decides the pipeline: who answers the business phone?**

| **Answer**                                                          | **Recipe**                  | **Chain**                                                           | **Our cost per clean cell** |
|---------------------------------------------------------------------|-----------------------------|---------------------------------------------------------------------|-----------------------------|
| **The owner** (trades, car shops, storefronts)                      | **A — Scrape**              | Google Maps → filter → BatchData verify                             | **\$0.02–0.07**             |
| **A receptionist** (dentist, CPA, lawyer, realtor, med spa)         | **B — Name → home → trace** | free name list → free county property record → BatchData skip trace | **\$0.15–0.27**             |
| **Nobody — no storefront** (investors, developers)                  | **B, no name step**         | property records ARE the list → skip trace                          | **\$0.20–0.23**             |
| **The state prints the phone** (WA/OR/CA contractors, PA licensees) | **C — Registry**            | licence file → BatchData verify                                     | **\$0.01–0.02**             |

Why recipe B costs more: a skip trace is \$0.07 and only ~45% come back
clean. Why it works: names and property records are free public data, so
we never pay for a name — only for the trace.

**The three things that protect the business:**

1.  **Every paid API call is metered in code** before it fires. A job
    > has a hard credit cap; when it's hit the job stops cleanly and
    > delivers what it has.

2.  **Any API error stops the job.** No retries with another vendor, no
    > "try something else." Log the response body, mark the job
    > needs_attention.

3.  **Never deliver the same number twice** to the same user, and never
    > deliver a number on the global suppression list to anyone.

## 2a. brain.json (what the app loads)

brain.json (in the project as BRAIN-routing-config.md) is the routing
table. For a job the app does: match industry against
industries\[\*\].aliases → get recipe, keyword/allow (recipe A) or
name_source per state (recipe B/C), expected_clean (the sample gate),
credits_per_clean_cell (from recipes). Then check states\[state\] has
what the recipe needs; if not, grey it out. Then run
recipes\[recipe\].steps in order through the engine. guardrails is the
list the job runner must enforce. When you measure a new industry or
state, edit the JSON — no code change.

## 2b. The engine (what you're wrapping)

engine.py (in the project as ENGINE-owner-cell-engine.md) is a CLI
today. Wrap it as a worker; don't rewrite the logic. Function map:

| **Function**                                                                 | **Paid?**      | **What it does**                                                                 | **Wrap as**                          |
|------------------------------------------------------------------------------|----------------|----------------------------------------------------------------------------------|--------------------------------------|
| outscraper(queries, limit)                                                   | \$0.0037/biz   | Google Maps search, async poll                                                   | job step scrape                      |
| verify(phones)                                                               | \$0.007/number | BatchData line type + DNC + litigator, 100/call                                  | job step verify                      |
| cmd_names (fl_re, fl_cpa, tx_trec, az_adre, il_idfpr, pa_pals, nppes, firms) | free           | pulls owner names from state licence files / NPPES / firm websites               | job step names                       |
| parcel_lookup(name, state) + PARCEL table                                    | free           | name → home address from county/state parcel layers (NC FL TX AZ IL PA GA TN WA) | job step parcel                      |
| cmd_investors                                                                | free           | owners with N–M properties, individuals only                                     | job step names (lane C)              |
| skip-trace loop in cmd_trace                                                 | \$0.07/person  | BatchData skip trace, 50/call, picks best clean mobile, keeps email              | job step trace                       |
| cmd_deliver                                                                  | free           | dedupe, DNC mode, time zone, xlsx (List / Summary / Legal)                       | job step deliver                     |
| meter\_\* / preflight                                                        | —              | cap check **before** each paid call                                              | replace with the credits ledger (§4) |

Where the endpoints live: PARCEL dict (ArcGIS layers), cmd_names
(licence files), plus STATE-COVERAGE-where-each-lane-works.md for the
ones not yet coded (Harris TX bulk file, Dallas, Pima, Snohomish,
Nashville, Fulton). Licence files should be **ingested nightly into
Postgres**, not fetched per job — FL RE (7 files, ~350k rows), FL CPA
xlsx, TREC CSV (325k), ADRE CSV (225k), IDFPR (Socrata, page it). NPPES:
ingest the monthly bulk file from download.cms.gov/nppes/NPI_Files.html.

**What's coded vs. described:** the engine runs Lane A anywhere, Lane B
in FL/NC/AZ/IL/PA (+TX Travis; Harris needs the HCAD bulk file indexed),
investors in NC. The coverage doc lists working endpoints for GA/TN/WA
parcels and the TX/AZ county files — wiring them is copying a row into
PARCEL.

## 3. Job flow (state machine)

draft → quoted → sample_running → sample_done → running → delivered

↘ needs_attention (any API error, cap hit, yield \< half of quote)



1.  **Input:** industry, geo (state list or nationwide), target_cells,
    > dnc_mode (strict \| flag).

2.  **Route:** industry → recipe via the table in §1 (keyword map in
    > MASTER-PROMPT Step 1). State → check state_coverage table: does
    > this state have a name source + address source for recipe B? If
    > not, either fall back to recipe A (if the industry allows) or
    > return "not available in yet" \*before\* charging anything.

3.  **Quote:** credits_needed = ceil(target_cells ×
    > credits_per_cell\[recipe\]) (§4). Show credits, ETA, and expected
    > yield. **Hold** the credits.

4.  **Sample (automatic, always):** run enough input for ~20 cells
    > (recipe A: ~100 businesses in 5 cities; B/C: ~50 names). Compare
    > clean rate to the expected rate for that industry (table in §5).
    > If \< half → stop, refund the hold, mark needs_attention with the
    > numbers. The user never sees this step fail silently.

5.  **Run:** widen (more cities / more names) until target_cells
    > delivered or the hold is exhausted. Every paid call checks the
    > job's remaining credits first.

6.  **Deliver:** xlsx + CSV, quality gates (§6) as blocking checks,
    > ledger written, credits **settled on delivered clean cells**
    > (unused hold released).

The user sees: Draft → Quote → Running (progress bar: scraped / verified
/ delivered) → Download. That's it.

## 4. Credits and pricing

Our real cost per **clean** cell, measured (n = 40–113 per industry):

| **Recipe** | **Industry examples**                                  | **Our cost / clean cell** | **Suggested price** | **Credits (1 credit = \$0.10)** | **Gross margin** |
|------------|--------------------------------------------------------|---------------------------|---------------------|---------------------------------|------------------|
| A scrape   | detailing                                              | \$0.02                    | \$0.20              | 2                               | 90%              |
| A scrape   | HVAC, roofing, plumbing, remodelers, auto repair, body | \$0.05–0.07               | \$0.20              | 2                               | 65–75%           |
| C registry | WA/OR/CA contractors, PA licensees                     | \$0.01–0.02               | \$0.20              | 2                               | 90%              |
| B trace    | CPAs, property managers, dentists, realtors            | \$0.15–0.25               | \$0.50              | 5                               | 50–70%           |
| B trace    | attorneys, med spas, developers, investors             | \$0.23–0.27               | \$0.60              | 6                               | 55%              |

Rules for the ledger:

- **Hold at quote, settle at delivery.** Charge only for clean cells
  > actually delivered; the sample's cost is ours (it's ~\$1). Failed
  > jobs cost the user nothing.

- **Per-job hard cap in dollars on our side** = credits_held × \$0.10 ×
  > 0.6 (never spend more than 60% of what we'll bill). This is the
  > engine's cap. Cap hit → deliver what exists, settle, done.

- **Global daily spend ceiling** per API key with alerting. Stop-loss:
  > any job whose running cost per clean cell exceeds 2× the table →
  > pause, needs_attention.

- dnc_mode = flag delivers DNC rows too (marked DNC — do not cold call).
  > Bill them at half rate; they're for email/ad retargeting, and
  > BatchData returns emails on most traced records — surface them.

- Re-scrub: a list older than 31 days is stale. Offer "refresh" at 1
  > credit per 10 numbers (our cost \$0.007 each).

## 5. Expected yields (the sample gate compares against these)

Clean = mobile AND not DNC. Any = at least one mobile found.

| **Industry**                                                                     | **Recipe** | **Clean**                                                 | **Any** |
|----------------------------------------------------------------------------------|------------|-----------------------------------------------------------|---------|
| Car detailing                                                                    | A          | 45%                                                       | 59%     |
| HVAC · roofing · remodelers · pool · landscaping · painters · fencing · concrete | A          | 16–23%                                                    | ~35%    |
| Auto repair / body                                                               | A          | 16–19%                                                    | 20–26%  |
| CPAs                                                                             | B          | 46–50%                                                    | 96%     |
| Realtors / brokers                                                               | B          | 28–56% (by state)                                         | 88–96%  |
| Property managers                                                                | B          | 38%                                                       | 90%     |
| Dentists / chiropractors                                                         | B          | 38%                                                       | 48%     |
| PI attorneys                                                                     | B          | 37% of traced (only ~13% of firms yield a traceable name) | 63%     |
| Med spas                                                                         | B          | 26%                                                       | 56%     |
| Developers (6–30 parcels)                                                        | B/C        | 30%                                                       | 80%     |
| Contractors WA/OR/CA                                                             | C          | 63%                                                       | —       |
| PA licensees with phone                                                          | C          | ~50%                                                      | 100%    |

Name → home match rate in a big county: **20–30%** (TX 20, AZ 22, IL 27,
NC 25–50). So 1,000 clean cells ≈ 2,200 traces ≈ 9,000 free names. Plan
the name ingest for that volume.

## 6. Data model (Postgres)

users(id, email, ...)

credits_ledger(id, user_id, delta, reason, job_id, created_at) -- append
only

jobs(id, user_id, industry, recipe, geo, target_cells, dnc_mode, state,

credits_held, credits_settled, cost_usd, cells_delivered,
sample_clean_rate, created_at)

job_spend(id, job_id, step, n, unit_cost, cost_usd, api_response_id,
created_at) -- the meter

businesses(place_id PK, name, phone10, street, city, state, zip,
website, rating, reviews,

category, subtypes, business_status, first_seen) -- shared cache, never
re-scrape a query \<90 days old

searches_run(query, city, state, run_at, results)

names(id, source, first, last, company, city, state, county, street,
zip, phone, email, ingested_at)

parcel_matches(name_id, state, owner_string, street, city, zip,
matched_at)

verified(phone10 PK, line_type, dnc, tcpa, reachable, carrier,
verified_at) -- cache 31 days

traced(name_id, phone10, line_type, dnc, tcpa, score, email, traced_at)

delivered(user_id, phone10, job_id, delivered_at) -- per user: never
twice

suppression(phone10 PK, reason, added_at) -- GLOBAL, PERMANENT

state_coverage(state, recipe, name_source, address_source, status,
notes) -- drives routing



Caches matter for margin: a verified number is good for 31 days for
*every* user, a scraped city for ~90 days. Second user asking for Tampa
roofers costs us almost nothing.

## 7. Quality gates (block delivery on any failure)

- zero duplicate phones in file · zero ∩ delivered for this user · zero
  > ∩ suppression

- every phone 10 digits, every row has company, every row has time zone

- zero landline / VoIP; zero tcpa; zero dnc unless flag mode (then
  > marked)

- clean rate between 10% and 70% of input (outside = broken filter)

- Lane A: positive category allowlist applied (engine builds it from the
  > keyword)

- Lane B: every traced address had number + street + suffix (engine's
  > street_ok)

- summary counts match the file

## 8. Compliance (engineering requirements, unchanged)

Manual dialling only. dnc_checked_at on every row; refuse export \>31
days old without override. Time zone on every row (8am–9pm recipient
time). Litigator flag excluded at build time. Legal Notes tab on every
file. Suppression list global and permanent — opt-outs from any user
suppress everywhere. **No SMS export path, ever.** Cell phones of sole
proprietors count as residential for DNC (Chennette v. Porch.com, 9th
Cir. 2022) — strict mode is the default and flag mode ships DNC rows for
email/retargeting, not calls; the UI must say that.

## 9. Build order

1.  Credits ledger + job state machine + per-job cap (the meter) —
    > nothing else runs without it.

2.  Lane A worker wrapping outscraper + verify + cmd_deliver, with the
    > businesses / verified caches. This is 70% of demand and it works
    > everywhere.

3.  Quality gates as blocking checks.

4.  Name ingest (FL, TX, AZ, IL licence files; NPPES bulk) + parcel
    > matcher from the PARCEL table → Lane B worker. Pilot on FL CPAs
    > and NC dentists (the two we measured best).

5.  Registry lane (WA L&I, PA PALS) — cheapest cells in the system;
    > small work.

6.  State coverage table in the UI: grey out states/industries with no
    > path instead of failing mid-job.

7.  Later: DNC-flag email/retargeting export, list refresh, investors
    > for TX/AZ/IL counties.

## 10. Do not build / do not re-research

BatchData property search (\$0.64/record) · Google Maps for attorneys,
CPAs, med spas (2–9%) · Datazapp / Apollo / ZoomInfo / Tracerfy / TLOxp
(rejected on cost, coverage or terms) · Twilio Lookup · skip tracing a
surname without a first name · tracing a name that matched two parcels ·
owner names in King County WA, Allegheny PA, Gwinnett GA (deliberately
withheld) · any auto-retry or vendor-switch on error · any SMS
integration.
