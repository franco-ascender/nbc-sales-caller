# Merged architecture: Owner Cell App plus the research program

This document reconciles Anas's Dev Handoff (file 05) with the Nalify research (files 04, 07, 08). Section 1 restates what Anas built and why it stays as is. Section 2 lists what the research adds, mapped onto his recipes. Section 3 defines recipe D. Section 4 resolves the vendor disagreements with measurement tasks. Section 5 gives the data model deltas. Section 6 gives the new industries and states. Section 7 is the compliance floor. Section 8 is the differentiator strategy and what it requires from the code.

## 1. What stays exactly as Anas designed it

The product shell is his and is not up for redesign: credits (1 credit = $0.10, hold at quote, settle on delivered clean cells), the job state machine (draft, quoted, sample_running, sample_done, running, delivered, needs_attention), the automatic 20 cell sample with the "under half of expected means stop and refund" gate, the per job dollar cap at 60 percent of billed credits, the global daily spend ceiling, the businesses and verified caches (90 days and 31 days), the quality gates as blocking checks, the xlsx deliverable with List, Summary and Legal tabs, and the do-not-build list.

The engine is his: engine.py functions outscraper, verify, cmd_names, parcel_lookup and the PARCEL table, cmd_investors, cmd_trace, cmd_deliver, meter and preflight. Wrap them as job steps; extend cmd_names with new sources in the same shape; do not rewrite.

His three recipes are the backbone:

| Recipe | Chain | When | Cost per clean cell (Anas, measured) |
|---|---|---|---|
| A. Scrape | Google Maps, filter, BatchData verify | The owner answers the business phone (trades, car shops, storefronts) | $0.02 to $0.07 |
| B. Name to home to trace | Free name list, free county parcel record, BatchData skip trace | A receptionist answers (dentist, CPA, lawyer, realtor, med spa) or there is no storefront (investors) | $0.15 to $0.27 |
| C. Registry | Licence file with phone, BatchData verify | The state prints the licensee's own phone (WA, OR, CA contractors, PA licensees) | $0.01 to $0.02 |

His single routing question, "who answers the business phone", is the same question the research asked in three parts ("is the owner named in a register", "is the phone on the register", "does the owner answer the Maps line"). The two frameworks are the same framework at different resolutions, which is why they merge cleanly.

## 2. What the research adds, mapped onto the recipes

**More recipe C sources (the cheapest cells in the system).** Anas found four registries with a phone. The research found fourteen more, all free, all VERIFIED unless noted:

| Source | Scope | What it carries | Notes |
|---|---|---|---|
| FL DBPR construction and electrical extracts | FL contractors | Qualifier (person), business, phone, weekly | Person level because Florida licenses the qualifier |
| MN DLI CSV exports | MN contractors | Name, phone, class | Master level only; employee rows reuse phones up to 189 times |
| Austin permits 3syk-w9eu, NYC DOB legacy permits ipu4-2q9a | Contractors | contractor_full_name, contractor_phone, trade; 98 percent phone fill in Austin | Also an activity signal |
| FMCSA Motor Carrier Census az4n-8mr2 | Movers, tree services, landscapers, haulers, nationwide | Legal name, DBA, phone, email, power units | 135,587 active HHG carriers, 82.5 percent with 3 or fewer trucks |
| TX TDLR 7358-krk7 Mini Establishment rows | TX salon suites | Business phone 99.9 percent, owner home mailing address 96 percent | owner_name equals business_name; identity from mailing address or Maps |
| FL DFS AllValidLicensesIndividual.csv | FL insurance licensees | Name, phone, email, address, daily, 323 MB | Owner filter by appointment count |
| IRS PTIN state extracts | Tax preparers nationwide | Name, DBA, business address, business phone, website | Released to vendors by law; no opt out |
| NY attorney registrations eqw2-r5nb | NY attorneys | Firm, phone, address, quarterly | 130,781 currently registered with NY addresses |
| PA childcare ajn5-kaxt, NY childcare cb42-qumz, TX childcare bc5r-88dy, DE iuzd-3dbt | Home providers | Provider name (the owner), phone, often email | Best identity plus contact register found; low marketing spend |
| New Orleans STR en36-xvxg, Orlando STR ssrj-rbua | Short term rental operators | Holder name, contact name, cell, email at 99 percent | Under 5 cents per cell |
| NYC DCWP w7w3-xahh | NYC home improvement contractors | Business, contact_phone | Business level |
| WA DOL ucdg-xgbj | WA dealers and tow operators | Entity, phone 99 percent | Entity level |
| CA BAR locator API | CA auto repair | Shop phone per licence | Public domain conditions, no scraping clause; rate limits UNKNOWN |
| PA HIC registry export | PA home improvement contractors | Primary applicant, phone | |

**More recipe B name sources (free names for the parcel plus trace path).** NY DOS salons and barbers y3u4-jbgh (owner named on 99.8 percent of 32,384 shops), NY DMV repair shops nhjr-rpi2 (owner named), TX TDI insurance relationships kvqi-vsrr (explicit Owner label on 9,212 rows), TX TABC 7hf9-qc9f (owner is a person on about two thirds of beer and wine rows), NY DOH food permits cnih-y5dw (operator named on 15,581), FL DBPR barbers lic03bb.csv (owner in the address block), FL Sunbiz SFTP officers (every LLC), CO SOS 4ykn-tg5h (agent is the owner for micro LLCs), SEC Form ADV Schedule A (RIA owners with ownership bands), TX TREC designated brokers (Anas has this), NPPES NPI-1 address roster for med spas (clinician at the spa's suite, 35 percent lower bound).

**Improvements inside recipe B.** The research found that several licence files carry the person's home street, so the parcel step can be skipped there (Anas already does this for FL RE and FL CPA): FL barbers (practitioner rows), TX mini salons (mailing address), NPPES NPI-1 mailing addresses (frequently residential, with a mailing phone that sometimes differs from the practice phone). The parcel step remains the bridge everywhere else. The research did not evaluate county parcel layers; Anas's PARCEL table and coverage doc are the source of truth for that step.

**A fourth recipe, D.** Section 3.

**Owner versus employee classification.** Recipe B in professional services needs an owner filter, and the research found free labels to train it: TX TDI association_type (Owner, DRLP, Employee), appointment counts (3 plus carriers means independent agency owner), TREC designated broker links, FL real estate broker with empty employer field, SEC Schedule A ownership bands, CSLB Personnel title codes (Sole Owner, RMO, RME, Partner, Officer, Member), WA businesstypecodedesc Individual, firm name contains the surname. Implement as a rule set first, a model later (section 8).

**Franchise and chain exclusion at zero cost.** The OpenStreetMap name suggestion index brand files (brands/shop/car_repair.json about 370 chains, brands/amenity/fast_food.json about 600 chains, plus the per industry lists in the research) replace hand maintained chain lists.

**Owner name extraction from reviews and about pages.** For unregistered sole proprietors (Group B trades, gyms, restaurants), a reviews scrape at $0.30 per 1,000 reviews plus a small language model extracts "the owner, Mike" at under a cent per listing. This is a new engine step (names --source reviews) used inside recipe A when the Maps phone is a mobile but the row has no name, and inside recipe B when no register names the owner. Not in Anas's engine; build in Phase 4.

**Legal gates by state and source.** The research added explicit prohibitions (SC, UT licensee lists; WA liquor; AZ ROC without the commercial request; CA small family child care; manufacturer locators) and an explicit dial window of 8 pm rather than 9 pm because Florida caps at 8 pm. The state coverage table gains a legal_status column.

## 3. Recipe D: contrast and buckets

Recipe D is recipe C plus a Google Maps scrape of the same trade and cities, and a matching step. It exists because the register phone is sometimes the owner's direct line and sometimes the front desk, and the only free way to tell them apart is to compare it with the number the business advertises.

Steps: names (registry with phone) then scrape (Maps for the trade in the register's cities) then bucket then verify then deliver. The bucket step matches register rows to Maps places on normalized business name plus address (rapidfuzz token sort ratio, name at or above 0.87, address at or above 0.90; manual review band 0.80 to 0.87 logged, not delivered) and assigns:

- **Bucket 1, in register, no Maps match.** The licensed but invisible owner. No marketing at all. Highest value for a marketing agency; a Maps first competitor cannot see them. Verify the register phone.
- **Bucket 2, matched, phones differ.** Register phone is the direct line candidate. Verify it.
- **Bucket 3, matched, phones equal.** Business line. Verify; keep only if mobile.
- **Bucket 4, Maps only.** Route to recipe A (the Maps phone) or B (name needed).

Phone reuse filter: drop register phones that appear on more than 3 licences (the MN employer trap; CSLB Sole Owner worst case is 5). Sort newest licence first (Anas measured 85 percent mobile on 2020s licences versus 18 percent on 2000s). Deliver with extra columns Bucket, Register Source, License Issue Date, Maps Phone.

Cost: one Maps scrape per register slice (about $20 to $40 per 5,000 to 10,000 places) on top of recipe C's verify cost. Credits: 2 per clean cell, same as C. Measured effect to expect: on NPPES organization records the register phone differed from the Maps phone in 36.7 percent of rows (28 percent among owner titled rows); on contractor registers this is unmeasured and is Phase 3's first measurement.

Recipe D applies wherever recipe C applies. It is built after C because it reuses C's names step and A's scrape step; the only new code is the bucket step and the extra columns.

## 4. Vendor disagreements and how they are resolved

Anas's do-not-build list rejects DataZapp, Twilio Lookup, Apollo, ZoomInfo, Tracerfy and TLOxp "on cost, coverage or terms". The research agrees on Apollo, ZoomInfo, TLOxp, Twilio and Tracerfy. It disagrees on two points and adds one, and in all three cases the resolution is a bounded measurement, not a change to the production recipes.

| Question | Anas's position | Research finding | Resolution (Phase 2 task) |
|---|---|---|---|
| Cell append vendor for recipe B | BatchData skip trace, $0.07 per person, about 45 percent clean | DataZapp Phone Append API, cell only mode, $0.02 to $0.03 per match, charged on matches only, $1,000 prepay to unlock the API; returns PhoneType, Cell, CellDoNotCall; hit rate on full legal names UNKNOWN | Run 500 identical name plus address records through both. Compare clean cell yield and cost per clean cell. Keep BatchData as the default; adopt DataZapp only if cost per clean cell is at least 30 percent lower at equal or better clean rate. Budget: about $60. If Anas rejected it on terms, get the terms text and stop here |
| Line type pre-gate in recipe A | BatchData verify on every scraped phone, $0.007 | Telnyx Number Lookup gives line type at $0.0025; only about 35 percent of Maps phones are mobile in the trades (Anas's "any" rate), so gating landlines out before BatchData would cut verify spend from $0.007 to about $0.0045 per scraped phone | Run 1,000 scraped phones through Telnyx then BatchData. Confirm Telnyx line type agrees with BatchData on at least 97 percent. If yes, insert Telnyx as a pre-gate in recipe A and D. Budget: about $10 |
| Mobile rate per register (the missing number) | Contractor registries 63 percent clean, PA PALS 50 percent (measured) | No other register measured; the research's cost model assumes 40 to 60 percent | Run 300 register phones from each new recipe C source through verify before enabling it in the UI. Set expected_clean in brain_v2.json from the result. Budget: about $2 per source |

Everything else in the stack table (Outscraper, BatchData verify, FTC DNC, the free registers, libpostal, rapidfuzz) is agreed. Apify remains the documented fallback scraper. RealPhoneValidation is noted for its business versus consumer caller type flag (useful ledger evidence) but is not required.

## 5. Data model deltas

Anas's tables stand (users, credits_ledger, jobs, job_spend, businesses, searches_run, names, parcel_matches, verified, traced, delivered, suppression, state_coverage). Add:

```
row_ledger(
  id, job_id, phone10, bucket, recipe,
  source_register, source_row_id, source_fetched_at,
  maps_place_id, maps_phone_at_fetch,
  business_line_evidence,        -- 'register_eq_maps' | 'verify_business_flag' | 'none'
  verify_vendor, verified_at, line_type,
  dnc_file_version, dnc_checked_at,
  litigator_vendor, litigator_checked_at,
  reassigned_checked_at,
  legal_gate,                    -- state/source rule applied
  tz, dial_window_start_local, dial_window_end_local,
  created_at
)

dial_outcomes(
  id, user_id, job_id, phone10, dialed_at_utc, dialed_at_local,
  outcome,                       -- reached_owner | gatekeeper | wrong_number | voicemail | disconnected | opt_out | no_answer
  features_snapshot jsonb,       -- recipe, bucket, source_register, title_code, business_type, phone_reuse_count,
                                 -- register_eq_maps, line_type, review_bucket, personnel_count, permit_velocity,
                                 -- license_age_years, state, industry, local_hour
  notes, created_at
)

register_snapshots(
  source, snapshot_date, row_hash, row_key, payload jsonb   -- for daily diffs (new licensees)
)

entity_graph_edges(
  from_type, from_id, to_type, to_id, relation, source, observed_at   -- person, business, license, phone, place, permit, sos_entity, npi
)
```

state_coverage gains columns: legal_status (ok, restricted, prohibited), legal_note, registry_phone_sources, name_sources, recipe_d_ready. names gains: source_row_id, title_code, business_type, license_issue_date, issuing_state, reuse_count. verified gains: vendor, caller_type (when available). jobs gains: recipe_version, brain_version.

Ingestion: licence files nightly into Postgres (Anas), plus the research sources on their own cadence (Socrata daily, FL DBPR weekly, NPPES monthly plus weekly delta, PTIN twice yearly, FMCSA monthly, Sunbiz daily plus quarterly full). Every ingest writes register_snapshots so the daily diff can find new rows.

## 6. New industries and states (summary; the JSON is the source of truth)

New industry keys in brain_v2.json, all n = 0 and measured_by research_estimate: contractor_fl, contractor_mn, contractor_permits, movers_tree_haulers, pest_control, salon_barber_ny, salon_suite_tx, barbershop_fl, childcare_home, childcare_center, insurance_agent_tx, insurance_agent_fl, tax_preparer, attorney_ny, auto_repair_ny, restaurant_tx, str_operator, healthcare_ao_contrast. Anas's med_spa and contractor_registry entries gain research notes; their numbers are untouched.

New or extended state rows: NY (six name sources, four phone sources), PA (childcare, HIC), TX (TDI, TABC, TDLR mini salons, Austin permits), FL (DBPR, DFS, hrfood, Sunbiz), MN, NJ, VA, DE, SC (prohibited), UT (prohibited), AZ (ROC only via commercial request), WA (SOS extract, childcare, DOL; legal note), CO (SOS agents, childcare).

The UI's coverage table greys out any industry plus state pair whose recipe lacks a source, exactly as Anas specified, and now also greys out prohibited sources with the legal note as the tooltip.

## 7. Compliance floor

Unchanged from Anas except two tightenings: the dial window ends at 8 pm local (Florida), and every row carries a row_ledger record. Manual dialling only; no SMS path; dnc_checked_at on every row; refuse export older than 31 days without override; litigator excluded at build time; Legal Notes tab on every file; suppression global and permanent; strict mode default; flag mode ships DNC rows for email and retargeting only and the UI must say so. Source gates: never voter files, DMV data, SC or UT licensee lists, WA liquor lists, NIPR, manufacturer locators; California small family child care phones never dialed; Arizona ROC only via the commercial public records process. CCPA: privacy notice, access and deletion mechanism, provenance per record (the ledger provides it).

## 8. The differentiator and what it requires from the code

Anyone with this package can build recipes A to D in a quarter. Two things compound and cannot be bought.

**The Owner Probability Score.** Every dial by an NBC Sales caller produces a label (dial_outcomes.outcome) with a feature snapshot. After roughly 20,000 dials, a logistic model over those features predicts, per state and industry, the probability that a candidate number reaches the owner, and the deliverable is sorted by it. The labels are generated inside NBC Sales and never leave. Code requirement: the outcome must be captured from the very first list, through the app's Called and Outcome columns on the xlsx and a matching endpoint, with the features_snapshot frozen at delivery time. Until the model exists, the score is the rule based formula from the research (source weight 0.25, phone differs from Maps 0.20, mobile 0.20, name match 0.15, sole proprietor 0.10, small business 0.10).

**The entity graph with history.** register_snapshots and entity_graph_edges accumulate what the public registers overwrite: who moved from RME to Sole Owner, which phone migrated from a company to a person, which licence lapsed and returned under a new LLC, which spa changed its medical director. A late entrant cannot download the history. Code requirement: every ingest is a snapshot and a diff, never an overwrite, from Phase 2 onward.

The compliance ledger (row_ledger) is the third asset: it is what makes the list legally sellable when competitors' lists are not, and it is cheap to build in Phase 0. The licensed but invisible bucket, daily new licensee alerts, reviews based owner names, permit velocity and language routing are good practice with a head start, and they follow once the four recipes run.
