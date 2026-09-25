# Build plan with acceptance criteria

Order follows Anas's build order (file 05, section 9) with the research additions inserted where they are cheapest to add. Each phase ends with a demo and a measurement. Nothing paid runs without the Phase 0 meter. Budget notes are our cost, not credits.

## Phase 0: the meter and the two memory tables (week 1)

Tasks

1. Supabase schema: Anas's tables (users, credits_ledger, jobs, job_spend, businesses, searches_run, names, parcel_matches, verified, traced, delivered, suppression, state_coverage) plus row_ledger, dial_outcomes, register_snapshots, entity_graph_edges (file 01, section 5). Migrations in the repo.
2. Credits ledger: append only; hold at quote; settle on delivery; refund on failed sample.
3. Job state machine: draft, quoted, sample_running, sample_done, running, delivered, needs_attention. Transitions logged.
4. The meter: a single function every paid call goes through; checks remaining credits times $0.10 times 0.6; on cap, returns stop. Global daily ceiling per API key with alert.
5. brain loader: loads 02_brain_v2.json (falls back to v1 shape), validates, exposes route(industry, state) returning recipe, sources, expected_clean, credits, legal_status.
6. Time zone resolver from ZIP (free dataset) and dial window 08:00 to 20:00 local.
7. Outcome capture: endpoint and xlsx round trip for Called and Outcome; features_snapshot frozen at delivery.

Acceptance: a fake job with a $1 cap stops at $1 with a clean ledger; a delivered row has a ledger record and an outcome can be posted against it; brain_v2.json loads and routes "hvac, FL" to recipe A and "chiropractor direct line, FL" to recipe D with legal_status ok, and "contractors, SC" to prohibited.

## Phase 1: Lane A everywhere (weeks 1 to 2)

Tasks

1. Wrap engine.outscraper, engine.verify, engine.cmd_deliver as job steps behind the meter. Businesses cache (90 days) and verified cache (31 days) shared across users.
2. Filter step per brain: no phone, toll free, duplicates, non operational, chains (add the OpenStreetMap brand files as a chain source), category allowlist from the keyword.
3. Sample gate: about 100 businesses across 5 default cities, compare to expected_clean, stop under half.
4. Quality gates as blocking checks (file 05, section 7).
5. Coverage table in the UI: grey out industry plus state pairs with no path or prohibited.

Acceptance: Tampa roofers job delivers an xlsx with zero duplicates, all rows mobile, DNC clean, litigator clean, time zone present, ledger written, credits settled only on delivered rows. Second identical job costs near zero (cache hit).

Demo: 500 verified owner cells for HVAC in Florida.

## Phase 2: Lane C on every register with a phone, and the three bake-offs (weeks 2 to 4)

Tasks

1. Nightly ingest framework: source, fetch, parse, normalize (E.164 via phonenumbers, libpostal for addresses, name parsing with corporate suffix stripping), write register_snapshots, upsert names with source_row_id, title_code, business_type, license_issue_date, reuse_count. One adapter per source. Start with Anas's four (WA m8qx-ubtq, OR g77e-6bhs, CSLB via headless __doPostBack, PA PALS) then add in this order: CSLB Personnel join (Sole Owner filter), FL DBPR construction and electrical extracts, IRS PTIN state files, FL DFS individual file (strip the Excel guards), FMCSA az4n-8mr2, PA childcare ajn5-kaxt, NY childcare cb42-qumz, TX childcare bc5r-88dy (home rows), NY attorneys eqw2-r5nb, TX TDLR Mini Establishment rows, New Orleans en36-xvxg and Orlando ssrj-rbua STR, MN DLI Master level, Austin permits 3syk-w9eu. Exact endpoints and traps in 04_SOURCE_CATALOG.md.
2. Lane C worker: names then verify (engine.trace in verify mode) then deliver, with the phone reuse filter (drop phones on more than 3 licences) and newest licence first.
3. Measurement task M1, mobile rate per register: 300 phones from each new source through verify before enabling it in the UI; write expected_clean into brain_v2.json with n and date. Budget about $2 per source.
4. Measurement task M2, Telnyx pre-gate: 1,000 scraped Lane A phones through Telnyx then BatchData; agreement on line type at or above 97 percent enables the pre-gate in recipes A and D. Budget about $10.
5. Measurement task M3, DataZapp versus BatchData: 500 identical name plus address records through both; adopt DataZapp for recipe B only if cost per clean cell is at least 30 percent lower at equal or better clean rate. First check the DataZapp terms; if Anas rejected on terms, stop. Budget about $60 plus DataZapp's $125 minimum.

Acceptance: at least eight recipe C sources ingest nightly with snapshots; each has a measured expected_clean; a "tax preparers, TX" job and a "childcare homes, PA" job deliver end to end; M1 to M3 results written into brain_v2.json and into a short MEASUREMENTS.md.

Demo: 5,000 California CSLB Sole Owner cells, the cheapest list in the system, plus the mobile rate table per register.

## Phase 3: Recipe D, contrast and buckets (weeks 4 to 5)

Tasks

1. Bucket step: match names rows to businesses rows (rapidfuzz token sort ratio on normalized name at or above 0.87 and address at or above 0.90; log the 0.80 to 0.87 band), assign buckets 1 to 4, compute register_eq_maps.
2. Recipe D worker: names, scrape (trade keyword in the register's cities), bucket, verify, deliver with Bucket, Register Source, License Issue Date, Maps Phone columns.
3. NPPES adapter: monthly bulk V.2 load (COPY into Postgres, indexes on postal code and taxonomy) plus weekly delta; NPI-2 Authorized Official fields; corporate filter (same AO name plus phone on 3 or more orgs; CMS num_org_mem from the Provider Data Catalog; DSO brand list); title filter (exclude credentialing, billing, office manager); surname in organization name rule; NPI-1 sole clinician at address rule.
4. healthcare_ao_contrast industry live for chiropractors, podiatrists, optometrists, dentists; bucket 3 and unmatched rows handed to Anas's recipe B (parcel plus trace).
5. Measurement M4: on the first 2,000 recipe D contractor rows, the share of bucket 2 (phones differ) and the clean rate per bucket; write into brain_v2.json.

Acceptance: a "florida contractors" recipe D job delivers with buckets populated; bucket 1 rows have no Maps place id; a chiropractor job in Florida delivers owner titled AO rows whose phone differs from the front desk.

Demo for Anas: the licensed but invisible bucket (licensed owners with no Google presence) and the Authorized Official direct lines.

## Phase 4: Lane B with the new name sources and the reviews extractor (weeks 5 to 8)

Tasks

1. Wrap engine.cmd_names, parcel_lookup and PARCEL, cmd_investors, cmd_trace, cmd_deliver as the Lane B worker exactly as Anas describes (file 05, sections 2b and 3). Pilot on FL CPAs and NC dentists (his best measured).
2. Name ingest for the research's B sources: NY DOS salons y3u4-jbgh, NY DMV repair shops nhjr-rpi2, TX TDI kvqi-vsrr (Owner and DRLP rows joined to kxv3-diwf), TX TABC 7hf9-qc9f, NY DOH cnih-y5dw, FL DBPR barbers lic03bb.csv (owner in address block; BR rows carry home street so skip parcel), FL Sunbiz SFTP officers (fixed length layout, up to six officers), CO SOS 4ykn-tg5h agents, SEC Form ADV monthly plus Schedule A.
3. Owner versus employee rule set for professional services (file 01, section 2) applied before any trace fires.
4. Med spa path from the research, in front of Anas's nppes --industry medspa step: NPI-1 address roster by postal code (NP 363L*, PA 363A*, RN 163W*) matched to the spa suite; Sunbiz officer search on the injector surname with two hops through member LLCs; TX Comptroller PIR officers; medical director graph (drop directors on 3 or more spas); franchise and registered agent service blocklists; website team page extraction. Measurement M5: clean rate of this path versus Anas's 26 percent on the same 100 spas.
5. Reviews and about page owner name extractor (new engine step names --source reviews): Apify reviews scraper at $0.30 per 1,000 reviews, 25 reviews per listing, small model extracts owner first and last name and language signal; used in recipe A when the phone is mobile and the row has no name, and in recipe B when no register names the owner.
6. Chain removal with the OpenStreetMap brand files for auto and food; franchise lists for cleaning, landscaping, gyms, med spas from 04_SOURCE_CATALOG.md.

Acceptance: "new york salons" and "texas insurance agents" jobs deliver through Lane B; reviews extractor names the owner on at least 20 percent of a 500 listing landscaping sample; med spa M5 result recorded.

## Phase 5: the compounding assets (weeks 8 to 12)

Tasks

1. Daily register diff: new rows in register_snapshots become a "new licensee" segment (first 90 days) with priority in the deliverable and an optional alert.
2. Entity graph edges written by every ingest and every match (person, business, license, phone, place, permit, sos_entity, npi), with observed_at, never overwritten.
3. Owner Probability Score v0: the rule based formula from file 01 section 8, applied as sort order. v1: logistic model trained on dial_outcomes once 5,000 labeled dials exist; retrain weekly; report lift per industry and state.
4. Refresh product (1 credit per 10 numbers), DNC flag mode export for email and retargeting with the UI wording Anas requires, investors for TX, AZ and IL counties.
5. Permit velocity and license age as score features; Shovels.ai evaluated only if free permit sources do not cover the target metros.

Acceptance: new licensee segment appears within 24 hours of a register change; score sorts deliverables; a weekly report shows reached owner rate by bucket, recipe, source and state.

## What not to build (merged list)

BatchData property search; Google Maps as the deliverable for attorneys, CPAs or med spas; Apollo, ZoomInfo, TLOxp, Tracerfy, Twilio Lookup, Clay, OpenCorporates, Data Axle; skip tracing a surname without a first name; tracing a name that matched two parcels; owner names in King County WA, Allegheny PA, Gwinnett GA; any auto retry or vendor switch on error; any SMS integration; voter files; DMV data; SC or UT licensee lists; WA liquor lists; NIPR; NMLS bulk; FINRA compilation; manufacturer provider locators in bulk; Instagram, Yelp, Booksy, Vagaro, Zocdoc bulk scraping as list sources; dialing California small family child care phones; a second verification vendor in production before M2 and M3 are measured.

## Open questions that gate specific tasks

- engine.py, STATE-COVERAGE and MASTER-PROMPT from Anas (gate Phase 1).
- DataZapp terms of service as Anas read them (gate M3).
- CSLB data portal terms text (the portal returned 503 during research; gate the CA list in the UI legal column).
- Washington: L&I file is PDDL but RCW 42.56.070(8) restricts commercial lists of individuals; a human legal read (gate WA in the UI legal column; keep per row ledger evidence either way).
- The full list of about 85 verification requests is at the end of 04_SOURCE_CATALOG.md, each with the exact request to run; work them as the corresponding source is ingested, never speculatively.
