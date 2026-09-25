# Lead sourcing — research handoff

**Purpose.** Hand this whole file to a fresh Claude conversation so it can continue the research in
parallel without redoing work or repeating mistakes. Last updated 2026-09-19.

---

## 1. What the project is

NBC Sales sells marketing services to small US business owners. The Lead Engine's job is to produce
**verified owner cell phone numbers** — mobile, live, not on the Do Not Call registry — so a human
salesperson can dial the owner directly instead of a receptionist. Calls are manual, one at a time.
There is no texting: cold SMS is explicitly forbidden by the product brief.

Working code already exists (Next.js + TypeScript + Supabase). Discovery through Apify works and has
produced real lists. Phone verification through BatchData works. What is being designed now is the
**sourcing strategy per industry**, which is what this document is about.

---

## 2. Standing rules — these are non-negotiable

1. **Never spend money without written consent.** Not an Apify run, not a BatchData check, not a data
   purchase. State the exact cost and wait for an explicit yes, every time. Free read-only endpoints
   (registry downloads, balance checks, metadata) do not need consent; spending does.
2. **Verify before asserting.** Never claim a source exists, is free, has an API, or contains a field
   until you have hit it yourself and seen the payload. A search-result summary is a hypothesis.
   This rule exists because an earlier claim that "California CSLB has no bulk data" was wrong and it
   turned out to be the single largest source available.
3. **Module by module.** Do not research every industry at once. Take one, run it to convergence,
   then move on.
4. **Iterate, don't stop at the first answer.** Form a hypothesis, test it, hunt for the vulnerability
   that breaks it, form a better hypothesis, repeat. Most findings below only appeared on the second
   or third pass.
5. **Label confidence.** Mark every claim as verified-by-you, reported-but-unverified, or unknown.

---

## 3. The method: three-way matching

No single source both identifies an owner and proves a phone belongs to them. Four roles:

| Role | Supplies | Alone it fails because |
|---|---|---|
| **A — identity** | a register that names the human owner | its phone may be an office or stale |
| **B — contact** | a phone attached to that person | a name beside a number proves nothing |
| **C — contrast** | the number the business advertises (Google Maps) | it is the gatekeeper line by definition |
| **D — validation** | BatchData: line type, DNC, TCPA, reachable | says nothing about who owns it |

**Decision rule:** if the registry phone ≠ the advertised phone, the registry phone is a strong
candidate for the owner's direct line. If they are equal, it is the main line and no bypass exists.
This generalises the 23% "Authorized Official phone differs from front desk" effect the client
measured in the federal NPPES registry.

**The pipeline is four stages and the scraper is never optional** — it supplies role C:

```
1 free register  ->  2 Apify/Outscraper expand  ->  3 merge + bucket  ->  4 BatchData verify
$0                   ~$0.004/business              $0                    $0.007/number
```

Stage 3 produces four buckets, not one list. The fourth is the most interesting: **in the register
but absent from Google Maps** = a licensed owner who does no marketing, which is exactly the ideal
customer for a marketing agency, and a Maps-first pipeline never finds them.

---

## 4. VERIFIED — hit directly, payload inspected

Everything in this section was confirmed by an actual request. Dates are when it was checked.

### Contractor / trade registers

| Source | Endpoint | Verified result |
|---|---|---|
| **CA CSLB** | `cslb.ca.gov/Onlineservices/Dataportal/ContractorList.aspx` | Free daily bulk, **no stable URL** — an ASP.NET page whose download fires via `__doPostBack`, so you must capture VIEWSTATE with a headless browser and replay the POST. Two files ~68 MB: **License Master 212,896 rows** (`BusinessPhone` on 99.9%) and **Personnel 311,059 rows** (real human names; only 1.77% equal the business name). Status field is **`CLEAR`**, not `ACTIVE` — filtering on ACTIVE returns zero. Do NOT buy the $235 mailed file; it is the same content. (18/09) |
| **WA L&I** | `data.wa.gov/resource/m8qx-ubtq.json` | 161,423 rows. `primaryprincipalname`, `phonenumber`, `businesstypecodedesc` (`Individual` isolates sole proprietors), `specialtycode1desc`. Open Socrata API, no key. (19/09) |
| **OR CCB** | `data.oregon.gov/resource/g77e-6bhs.json` | 56,247 rows. `full_name` (business), `rmi_name` (person), `phone_number`. Full CSV at `/api/views/g77e-6bhs/rows.csv?accessType=DOWNLOAD`. (19/09) |
| **MN DLI** | `secure.doli.state.mn.us/ccld/data/MNDLILicRegCertExport_<Category>.csv` | Anonymous GET, no auth. Electrical 103,498 rows, Plumbing 33,309. Columns include `Bus_Pers`, `Name`, `Phone_No`, `License_Subtype`, `Status`. `Email_Address` exists but is **empty on every row**. `Status` mixes case (`Issued`/`LICENSED`). (19/09) |

### Measured funnel, identical filter applied to each

Filter chain: licence live → phone is a valid 10-digit US number and not toll-free → a person is named
→ that phone is used by only one licence → dedupe to distinct (person, phone).

| Source | Start | Distinct people w/ exclusive phone | Yield | Worst phone reuse |
|---|---|---|---|---|
| **CA CSLB** sole owners | 104,399 | **93,755** | 89.8% | x5 — clean |
| WA L&I, all types | 161,423 | 68,937 | 42.7% | x17 |
| OR CCB | 56,247 | 36,883 | 65.6% | x14 |
| MN electrical | 103,498 | 27,308 | 26.4% | **x189 — dirty** |
| WA L&I, `Individual` only | 32,921 | 9,712 | 29.5% | x3 — clean |
| MN plumbing | 33,309 | 6,259 | 18.8% | x13 |

**California is both the largest and the cleanest.** CA and WA-Individual are the only two where phone
reuse is negligible.

### Other verified sources

- **NPPES** (`npiregistry.cms.hhs.gov/api/?version=2.1&...`) — free, no key. Authorized Official name,
  title and phone. A live call for NC chiropractors returned 5 clinics, **4 of 5 with an AO phone
  different from the practice line**. Bulk file at `download.cms.gov/nppes/NPI_Files.html`.
  **There is no "Medical Spa" taxonomy** — the API answers `No taxonomy codes found with entered
  description`. Med spas cannot be pulled directly.
- **TX childcare** `data.texas.gov/resource/bc5r-88dy.json` — 14,971 rows, phone on 14,909 (99.6%),
  CC0 licence. Home-based operations carry the owner's personal name as the operation name.
- **CA childcare** `data.chhs.ca.gov` CSVs — Family Child Care Homes 19,759 rows, `licensee` +
  `facility_administrator` + `facility_telephone_number` on **100%**. Caveat: `facility_address` reads
  `Unavailable` on every home row, and `file_date` was `05252025`, i.e. ~4 months stale.
- **FL DFS insurance** `myfloridacfo.com/downloads/AAS/LicenseeSearch/AllValidLicensesIndividual.csv`
  — 323 MB, refreshed daily, carries **name + phone + email + address together**. Excel `="…"` guards
  wrap phone/zip/NPN; strip on ingest.
- **Apify** — actor `compass/crawler-google-places`, id `nwua9Gu5YrADL7ZDj`, build `0.14.757`.
  Pay-per-event: `place-scraped` **$0.004** on the FREE plan tier (tiered down to $0.000756 on
  DIAMOND). The actor **refuses any run with `maxTotalChargeUsd` under $0.50**, which sets a minimum
  batch of ~125 businesses. Output fields confirmed against a live run: `title, city, state,
  countryCode, phoneUnformatted, placeId, categoryName, permanentlyClosed, temporarilyClosed, url,
  website` — and `permanentlyClosed`/`temporarilyClosed` ARE emitted as explicit `false`.
- **BatchData** `POST api.batchdata.com/api/v1/phone/verification`, `Authorization: Bearer`, body
  `{"requests":["7045551234"]}`. Returns `results.phoneNumbers[]` with `type, dnc, tcpa, reachable,
  carrier, number`. **Two traps, both hit in production:** it **returns results in its own order**, so
  match by number and never by position; and a dry account answers **403 with "Insufficient balance"
  only in the body**, never in the status code.
- **Outscraper** `GET api.outscraper.cloud/profile/balance` with `X-API-KEY` — free read, works.

### Environment limitation

**NANPA does not resolve from this sandbox** (`nationalnanpa.com`, `nationalpooling.com`, and
`raw.githubusercontent.com` all fail DNS). The free NPA-NXX route to line-type data is therefore
closed here. A conversation on a different network should retry it — it would give a free estimate of
the mobile rate across an entire registry.

---

## 5. Traps and disproven claims — do not rediscover these

- **MN "Personal" rows are largely employees, not owners.** One phone appears on **189 licences** —
  an employer registering its unlicensed workers. `Registered Unlicensed` and journeyman subtypes
  share phones at 1–4%; **Class A Master Electrician shares at 0.2%** and Master Plumber at 1.0%. The
  real owner pool in Minnesota is roughly **10,100 Master-level licences, not the ~58,000** an earlier
  pass reported.
- **A register's field name lies.** In Texas TDLR, the salon files have a column called `owner_name`
  that is a byte-for-byte copy of `business_name` on all 71,435 establishments — zero real people.
  *(Reported by a research pass, not personally re-verified.)*
- **Two files from the same agency behave differently.** TX TDLR Electrical Contractor reportedly
  carries a phone on 99.96% of rows while A/C Contractor carries **zero** phone and zero address.
  Never assume one file's coverage from another's. *(Reported, unverified.)*
- **Connecticut:** filter on `active='1'`, never `status='ACTIVE'` — CT also uses `ACTIVE IN RENEWAL`
  and `APPROVED`, and the wrong filter drops plumbing from 2,824 rows to 14. *(Reported, unverified.)*
- **NMLS is a dead end.** Its B2B bulk product runs **$85,000/yr** for the daily tier and the
  `Individual` file contains no phone at all — the spec has zero hits for "phone". The phone appears
  on the public website one broker at a time. *(Reported, unverified — but the price list is public.)*
- **Apollo cannot be reverse-engineered.** Per Apollo's own documentation its phone data comes from a
  **contributor network of 2M+ users who connect their inbox and CRM**, plus licensed third-party
  data — not from scraping. Replicating it means building that network, not copying a technique.
- **Most registers publish identity, not contact.** Of roughly 15 probed, only Washington, Oregon,
  Texas childcare, Florida insurance and California CSLB carried a person *and* a phone. Everywhere
  else, budget for a paid append (~$0.03, ~45% hit).

---

## 6. The measured insight that justifies the two-stage design

Washington's clean base broken down by trade:

```
GENERAL       50,628        ROOFING    516
PAINTING       2,278        HVAC       579
FLOORING       1,864        CONCRETE   716
LANDSCAPING    1,478
```

Ask the register for roofers in Washington and you get 516, because most contractors license as
"GENERAL" — the state classifies the *permission*, not the trade.

**So the register knows WHO owns the business and Google Maps knows WHAT TRADE it does.** Neither is
sufficient alone. That is a measured fact, not a design preference, and it is the core argument for
running both stages on every industry.

---

## 7. Open research agenda — what the parallel conversation should attack

Ordered by value. Each is genuinely unresolved.

1. **Mobile rate per source.** The single missing number: what fraction of registry phones are
   mobile and DNC-clear. Requires either a paid BatchData sample (consent pending) or a free NPA-NXX
   dataset reachable from your network. The only real datapoint so far is **20% mobile on Google Maps
   business numbers** (10 Miami roofing numbers, 2 mobile). The untested hypothesis is that registry
   phones perform far better because a sole proprietor registers their own number.
2. **Med spas.** NPPES has no taxonomy for them, and a cash-pay spa may hold no NPI at all. **The
   client (Anas) reportedly found a workaround in his own research — ask him for it before
   rebuilding it.** Candidate stack otherwise: NPPES matched by practice address via NP/RN/derm
   taxonomies, Florida Sunbiz free bulk for LLC officers, the Tennessee med spa registry (the only
   state with one), Texas TDLR esthetician establishment licences.
3. **Voter files.** Public in most states, and a natural bridge from a name to a home phone. **Many
   states bar commercial use outright** — this is binary per state and completely unresearched.
4. **Legal review of licensee lists.** Several states restrict using a licence register for
   solicitation. A record being public does not make it usable for sales. No review has been done.
   This blocks the first campaign and needs a human with legal judgement.
5. **CA BAR locator API terms.** `POST bar.ca.gov/api/autoshoplocator/getards` returns shop phones with
   no auth, but its terms of use and rate limits for bulk tiling were never checked.
6. **Is "Sole Owner" the right CSLB filter?** Licences with exactly one listed person who are not
   tagged Sole Owner may also be owners. Untested — the working files were cleared before this ran.

**Discovery tool:** `https://api.us.socrata.com/api/catalog/v1?q=<term>` searches every US state
open-data portal at once. Every Socrata source in this document was found through it. Query it before
concluding an industry has no register.

---

## 8. Compliance, which governs everything regardless of source

Manual dialing only — no autodialer, no prerecorded message, no ringless voicemail. Calls 8:00am–9:00pm
**in the recipient's own time zone**, which is why every delivered row must carry a resolved IANA time
zone and why an unresolvable one is held back rather than shipped. DNC and TCPA-litigator scrub is
accurate only on the build date and must be repeated every 31 days. Suppression is global and
permanent across every client and industry. No SMS path exists and none should be built.
