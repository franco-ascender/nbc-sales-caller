# Industry workflows — one source strategy per industry

**Status: design in progress.** Written for Franco and Anas, 2026-09-18, after Anas's direction that
each industry needs its own workflow. Sections marked RESEARCH PENDING are being verified and must
not be built against until they are filled in.

## THE PIPELINE — four stages, always all four

The registry and the scraper are not alternatives. They are sequential stages that compound, and the
scraper is never optional: it supplies the contrast phone that the whole three-way match depends on.

```
  STAGE 1          STAGE 2            STAGE 3              STAGE 4
  FREE SOURCE  ->  SCRAPER EXPAND  -> MERGE + MATCH    ->  BATCH VERIFY
  (per industry)   (Apify/Outscraper) (three-way)          (BatchData)
  identity+phone   business+phone     bucket by signal     Mobile/DNC/TCPA
  $0               $0.003-0.004       $0                   $0.007/number
```

**Stage 3 always produces four buckets, not one list.** This is where the value is decided:

```
  registry phone  !=  maps phone   ->  OWNER DIRECT LINE      <- highest value
  registry phone  ==  maps phone   ->  main line, gatekeeper
  in maps, not in registry         ->  unlicensed or new, no name yet
  in registry, not in maps         ->  no online presence     <- often the best ICP:
                                                                 an owner with no marketing
```

The fourth bucket is worth naming: a licensed contractor with no Google presence is an owner-operator
who does not market. That is precisely who we sell marketing to, and no Maps-first pipeline would
ever have found them.

## PER-INDUSTRY WORKFLOWS

### 1. Home services / trades — registry first

```
 [1] CSLB / L&I / CCB / MN DLI        owner name + registry phone + address   $0
      |
 [2] Apify Maps "<trade> in <city>"   business + published phone + website    $0.004/biz
      +-- Apify Contact Details on the website                                 $0.00105/site
      |
 [3] join on business name + city/address
      -> four buckets above
      |
 [4] BatchData on every distinct number                                        $0.007
```

### 2. Med spas — SCRAPER FIRST, registry second (the order inverts)

No registry lists med spas, so there is nothing to start from. The scraper builds the universe and
the free sources enrich it.

```
 [1] Apify Maps "med spa in <city>"   THE list + phone + website    $0.004/biz
      |
 [2] match each practice address against NPPES (NP / RN / dermatology / plastics)   $0
      + match business name against Secretary of State (FL Sunbiz is free bulk)     $0
      -> yields the medical director or LLC member name
      |
 [3] NPPES AO phone != maps phone -> bypass candidate
      no NPPES match at all        -> cash-pay spa, name unknown
      |
 [4] BatchData                                                                  $0.007
```

### 3. Salons / barbers / nails / tattoo — the two legs are split across sources

Not broken. One source has the name, the other has the phone; only the join produces a lead.

```
 [1] NY DOS / FL DBPR / CT DPH       person name + street address, NO phone    $0
      |
 [2] Apify Maps "<salon> in <city>"  business phone + website                  $0.004/biz
      (in TX the registry also carries the shop phone at 99.96%, so both legs
       are free there, but still no person)
      |
 [3] join registry person <-> maps business on name + address
      -> matched   : person + phone
      -> unmatched : paid append on name+address, ~$0.03, ~45%
      |
 [4] BatchData                                                                  $0.007
```

### 4. Licensed healthcare — the 23% bypass

```
 [1] NPPES              Authorized Official name + AO phone + practice address  $0
      + state board     confirms the individual practitioner                    $0
      |
 [2] Apify Maps         practice front-desk phone + website                     $0.004
      |
 [3] AO phone != practice phone -> direct line (measured at 23% by Anas)
      AO phone == practice phone -> front desk, needs append
      |
 [4] BatchData                                                                  $0.007
```

### 5. Childcare — the licence is the person

```
 [1] CA CCLD / TX HHSC / NY OCFS    provider name + phone + city               $0
      |
 [2] Apify Maps                      published phone + reviews + website        $0.004
      |
 [3] home daycare: licensee == administrator == the person answering
      licence phone != maps phone -> personal line
      |
 [4] BatchData                                                                  $0.007
```

### 6. Auto repair — split by state

```
 NY:  [1] DMV nhjr-rpi2   owner person name, no phone      $0
      [2] Apify Maps      shop phone + website             $0.004
      [3] join -> name + phone, free on both legs
      [4] BatchData

 CA:  [1] BAR bulk + locator API   shop + phone, NO owner name anywhere   $0
      [2] Apify Maps               confirm + website
      [3] no owner exists in any CA source -> shop-level only, or paid append
      [4] BatchData
```

### 7. Agencies / SaaS / e-commerce — no licence exists

```
 [1] nothing free                                           -
 [2] Apollo people search + Maps if they have an office     $49-99/mo
 [3] no registry leg, so no three-way match is possible
 [4] BatchData                                              $0.007
```

## THE PLAYBOOK — what to run, per industry

One row per industry we target. Every source marked **verified** was hit directly and its payload
inspected; anything else is labelled. Cost is per delivered callable cell. Every path ends in
BatchData at $0.007 per number checked, and **no paid call runs without Franco's written consent.**

### Tier 1 — the owner is on a public licence, with a phone. Cheapest, run these first.

| Industry | State | Identity + phone source | Volume w/ phone | Contrast | Cost | Status |
|---|---|---|---|---|---|---|
| **Home services / trades** | **CA** | CSLB bulk: Personnel joined to Master on licence no. | **104,353 owners** | Maps | $0 + verify | **verified** |
| Home services / trades | MN | DLI CSV, `Bus_Pers=Personal` | ~58,000 active | Maps | $0 + verify | **verified** |
| Home services / trades | OR | CCB `g77e-6bhs`, `rmi_name` | 50,608 | Maps | $0 + verify | **verified** |
| Home services / trades | WA | L&I `m8qx-ubtq`, `businesstypecodedesc=Individual` | 9,874 sole props | Maps | $0 + verify | **verified** |
| Plumbing | TX | TSBPE `download-csv/RMP/` | 8,714 (51% phone) | Maps | $0 + verify | **verified** |
| Electrical | TX | TDLR `Lteecele.csv` | 14,019 (99.96%) | Maps | $0 + verify | **verified** |
| Trades | LA | LSLBC roster POST, `QualifyingParty` | 8,186 (53% phone, 100% email) | Maps | $0 + verify | **verified** |
| Trades | OH | OCILB roster generator | 3,055 plumbing (68%) | Maps | $0 + verify | **verified** |
| **Childcare** | CA, TX, NY | CCLD / HHSC / OCFS | **~38,000** | none needed | $0 + verify | **verified** |
| Licensed healthcare | all US | NPPES, Authorized Official | AO phone, 23% differ from front desk | Maps | $0 + verify | **verified, built** |
| Insurance agents | FL | DFS `AllValidLicensesIndividual.csv` | name + phone + **email** | — | $0 + verify | **verified** |

### Tier 2 — identity is free, the phone must be bought

Registry gives the name; a paid append (Datazapp, name+address → cell, ~$0.03, ~45% hit) supplies the
number. Cost per cell rises to roughly $0.04–0.09.

| Industry | Best identity source | Volume | Why no phone |
|---|---|---|---|
| Real estate | CA DRE 429k · TX TREC 325k · NY DOS 147k · CO DORA 110k | ~1M names | No registry publishes it |
| Insurance (non-FL) | TX TDI 970k, NPN joins to the FL file | 970k | — |
| Trades (VA, FL, CT, CO, OR-BCD) | VA DPOR 30k (**80% email**), FL ECLB 20k, CT 15k | ~95k | — |
| Auto repair | NY DMV `nhjr-rpi2`, `owner_name` 100% real people | 21,711 shops | — |

### Tier 3 — structurally broken. Do not promise an owner cell here.

| Industry | Why | What we can honestly sell |
|---|---|---|
| **Salons · barbers · nails · tattoo** | Verified across TX, FL, NY, CT, CO, IL: **no state publishes establishment owner + phone.** TX has the phone on 99.96% but its `owner_name` is a byte-for-byte copy of `business_name` — zero real people | Either the salon's business line (TX, 71,435 shops) or a name from NY/FL plus a paid append. Never both free |
| **Med spas** | **NPPES has no med spa taxonomy** — verified, the API says the code does not exist. Cash-pay spas may hold no NPI at all | Nothing yet. Requires a 200-record match-rate pilot before we quote anything |
| Auto repair, CA | BAR bulk has phone on 35,473 shops but `First Name` is blank on **100%** of rows | The shop, not the owner |
| Agencies · SaaS · e-commerce | No licence exists anywhere. Nothing forces these owners onto a public register | Apollo, at its stated 20–40% mobile coverage and $0.20–0.50/cell |

### Contingency per tier

- **Tier 1 source goes stale or offline** → fall back to Maps-first discovery for that state, which is
  the path already built and working. Worse yield, known cost.
- **A registry silently changes a column** (this is a real failure mode: TX HVAC carries zero phone
  while TX electrical carries 99.96%) → the ingestor must assert field coverage on every pull and
  refuse to proceed when coverage drops below the recorded baseline, rather than deliver empty rows.
- **Append hit rate below 45%** → stop and re-measure before scaling; Anas's rule is that nothing is
  quoted as a price until piloted at 300 records.
- **A state bars commercial use of its list** → that state drops to Maps-first. This is unresolved and
  blocking; see the legal section.

## The mistake this document corrects

Today the engine runs one path for every industry: Google Maps via Apify, then phone verification.
That path returns the number a business publishes so customers can call it — the front desk. It never
returns the owner's name.

Measured on our own Miami roofing run, 2026-09-18: of the first 10 published numbers verified,
**8 were landlines and 2 were mobile**. The brief's benchmark is 49.8% mobile. Maps-first is the
wrong entry point for a product whose entire purpose is reaching the owner.

## The principle: three-way matching

No single tool identifies an owner and proves a phone belongs to them. The method is to cross three
independent sources so that each one covers the others' blind spot.

| Role | What it supplies | Why it alone is not enough |
|---|---|---|
| **A — Identity** | A registry that names the human owner | Its phone may be an office, an accountant, or stale |
| **B — Contact** | A phone attached to that named human | A name next to a number is not proof of reachability |
| **C — Contrast** | The publicly advertised business number (Maps) | It is the gatekeeper line by definition |
| **D — Validation** | BatchData: line type, DNC, TCPA, reachable | Says nothing about who owns the number |

**Registries give identity, not contact.** This is the finding that shapes everything below. Of the
~15 state registries probed on 2026-09-18, only three carried a person's name *and* a phone:
Washington L&I, Oregon CCB, and Texas childcare. Everywhere else the registry supplies A only, and B
has to be bridged by a paid append (Anas's brief: Datazapp, name + address → cell, $0.03 per match,
~45% hit rate). Budget for the append in every industry except those three.

**The decision rule.** Compare B against C:

- **B ≠ C** → the registry phone is not the number the business advertises, so it is a strong
  candidate for the owner's direct line. This is the same signal Anas measured in NPPES, where the
  Authorized Official's phone differs from the front desk 23% of the time. That gap is the product.
- **B = C** → the registry simply lists the main line. No bypass. This record needs an append or is
  a gatekeeper, and should be priced and labelled as such, not shipped as an owner cell.

Only records where D confirms Mobile + not DNC + not TCPA + reachable are delivered. The evidence
rules already implemented in `lead-engine-research.ts` score exactly this: a direct contact plus an
independent corroborating source. Until now nothing fed them.

## Industries group by where the owner is legally forced to register a name

The useful question is not "what does this business do" but **"which authority made the owner write
their name on a public form?"** That determines the workflow.

### Group 1 — Owner licensed as a contractor *(owner is in the truck)*

Roofing · HVAC · plumbing · electrical · concrete · masonry · fencing · landscaping · hardscape ·
painting · flooring · remodeling · kitchen & bath · windows & doors · garage doors · gutters ·
siding · restoration · pressure washing · pool service · handyman · tree · decks & patios · pavers

These owners must hold a licence to work legally, and they also advertise on Maps because they need
inbound calls. That gives us A and C from two genuinely independent places.

- **A + B:** state contractor licence registry — owner name and a registered phone
- **C:** Google Maps listing for the same business
- **D:** BatchData

Verified working and free, 2026-09-18. Sources that carry **a person and a phone**:

| State | Source | Volume | Person field | Phone |
|---|---|---|---|---|
| **Minnesota DLI** | `secure.doli.state.mn.us/ccld/data/MNDLILicRegCertExport_<Cat>.csv` | Plumbing 36,819 · Electrical 109,630 · **~58k active** | `Name`, and `Bus_Pers` separates Personal from Business | **91–94%** |
| **Washington L&I** | `data.wa.gov` `m8qx-ubtq` | 161,397 total · 75,993 active · **9,874 sole proprietors** | `primaryprincipalname` | **99.95%** |
| **Oregon CCB** | `data.oregon.gov` `g77e-6bhs` | 56,247 | `rmi_name` (90%) | **99.97%** |
| **Texas TSBPE** (plumbing) | `tsbpe.texas.gov/download-csv/RMP/` | 9,368 · 8,714 current | last/first name 100%, `PLUMB_COMPANY` 99.9% | 51% |
| **Louisiana LSLBC** | roster POST → CSV, fee returned **$0.00** | 36,749 · 8,186 active trade | `QualifyingParty` 99.9% | 53%, **email 100%** |
| **Ohio OCILB** | `elicense4.com.ohio.gov/Lookup/GenerateRoster.aspx` | Plumbing 3,055 active | `Name` 100% | 68% company phone |
| **Texas TDLR electrical** | `tdlr.texas.gov/dbproduction2/Lteecele.csv` | 14,019 | owner_name 100% | **99.96%** |

Minnesota is the strongest of these: it licenses the individual tradesperson, so `Bus_Pers=Personal`
isolates humans directly, with their own street address and phone. Verified sample:

```
DONAVAN A HELLKAMP | 409 2nd St NW, Stewartville, MN 55976 | 507-226-2907
```

Name + address, phone to be appended: Virginia DPOR (30,217, **80% email**), Florida ECLB (19,874),
Connecticut (15,275 active trade), Colorado (~95k), Oregon BCD (47,959).

**Gotchas that cost real money if missed:**
- **Connecticut:** never filter `status='ACTIVE'`. CT also uses `ACTIVE IN RENEWAL` and `APPROVED`;
  that filter drops plumbing from 2,824 rows to 14. Filter `active='1'`.
- **Texas TDLR:** Electrical Contractor carries 99.96% phone, but **A/C Contractor carries zero phone
  and zero address** — 20,436 rows of name and county only. Do not assume one TDLR file behaves like another.
- **Minnesota:** `Status` mixes case (`Issued`/`LICENSED`/`Expired`/`EXPIRED`) — normalise. The
  `Email_Address` column exists but is empty on every row.
- **Louisiana:** plumbing licensure moves to LSLBC on 1 Jan 2027, after which LA plumbers land in the
  roster CSV that already carries phone and email.
- **Michigan:** bulk is FOIA-only at a **flat $25**, delivered as CSV. A cheap test of whether they
  include phone.

**California is the largest source in this entire map.** The earlier "no API" conclusion was wrong.
CSLB publishes free bulk data through its Data Portal
(`cslb.ca.gov/Onlineservices/Dataportal/ContractorList.aspx`), stamped daily, no registration, and
explicitly free of charge. It is not a REST API: an ASP.NET page whose download buttons fire through
`__doPostBack`, so a fetcher has to capture VIEWSTATE with a headless browser and replay the postback.
There are no stable direct file URLs.

Two files, both ~68 MB:

- **License Master** — 212,896 rows: business name, mailing address, city, county, zip,
  `BusinessPhone` on **99.9%**, type, status, classifications.
- **Personnel** — 311,059 rows: `Name` and title, joined to the master on licence number.

Verified independently on 2026-09-18 by joining the two files locally:

```
Sole Owner rows joined to the master:  104,399
Of those, carrying a phone:            104,353  (100.0%)

SHEFLO HARVEY B | SHEFLO PLUMBING CO | (818) 991-8475 | AGOURA HILLS
```

The personnel names are real humans, not business-name copies — only 1.77% of joined rows have
`Name == BusinessName`, against 100% duplication in the Texas salon file. Titles break down as Sole
Owner 124,673 · Officer 80,032 · RMO/CEO/President 37,371 · General Partner 3,245.

**Do not buy the CSLB paid file.** The $235 Full File / Update File ordered by mail carries the same
content as the free portal.

### Group 2 — Owner licensed as a health professional *(a front desk answers)*

Chiropractors · dentists · optometrists · physical therapists · veterinarians · dermatology ·
podiatry · orthodontics

- **A + B:** NPPES, free federal registry, Authorized Official name, title and phone. Already built
  and verified working (`lead-engine-nppes.ts`); a live call returned 5 NC chiropractic clinics with
  4 of 5 showing an AO phone different from the practice line.
- **C:** the practice's Maps listing
- **Second identity source:** the state professional licensing board, which names the individual
  practitioner and confirms the person behind the AO name
- **D:** BatchData

### Group 3 — Owner licensed through an establishment licence

Salons · barbershops · nail salons · tattoo studios

**This category is structurally broken for our purpose, and that is a verified finding, not a gap in
the search.** No state was found that publishes an establishment's owner as a person *and* a phone.
You get one or the other:

| Source | Rows | Gives | Missing |
|---|---|---|---|
| **TX TDLR establishments** `7358-krk7` | 71,435 salons | phone on **99.96%**, street address, geocode | `owner_name` is a byte-for-byte copy of `business_name` — a count of rows where they differ returns **0**. No person, ever |
| **NY DOS** `y3u4-jbgh` | 32,361 | `license_holder_name` is a real person + trade name + street address | no phone |
| **FL DBPR** `COSMETOLOGYLICENSE_1.csv` | 423,559 | person names, home street addresses | no phone. Of 32,577 salon rows only **197** carry a parseable person name |
| **CT DPH** `ngch-56tr` | 2.66M credentials incl. **1,703 tattoo technicians** | person name + street address | no phone; no establishment licence type exists |
| CO DORA, IL IDFPR | 23k / 24k salons | business name | no phone, no street address |

So the choice is explicit: call the salon by its business number, or buy a phone append on top of a
name. There is no free path to "owner name + owner phone" here. Washington DOL is a hard dead end —
its professional rosters go only to approved educators and associations.

### Group 4 — Owner licensed as an individual professional

Realtors · mortgage brokers · insurance agents · financial advisors

**Florida DFS is the strongest source found anywhere in this map.** Verified live 2026-09-18: a free,
unauthenticated CSV, 323 MB, refreshed that morning at 06:22, carrying name, **phone, email and
address together** — the only bulk file found with all three.

```
https://www.myfloridacfo.com/downloads/AAS/LicenseeSearch/AllValidLicensesIndividual.csv

"Full Name","Email Address","Business Phone","Business Address1",...
"WALKER, KEITH J", INSSOL1@EARTHLINK.NET, 2394037420, 2171 PINE RIDGE RD, NAPLES, FL
```

It includes non-resident licensees, so its reach goes well past Florida. The CSV wraps phone, zip and
NPN in Excel `="…"` guards — strip them on ingest.

| Source | Rows | Name | Phone | Email | Cost | Verdict |
|---|---|---|---|---|---|---|
| **FL DFS insurance** `myfloridacfo.com/downloads/AAS/LicenseeSearch/` | — | yes | **yes** | **yes** | free, daily | **Start here** |
| **AZ ADRE real estate** `services.azre.gov/PdbWeb/List/DownloadList/1` | — | yes | employer line | no | free | Usable now |
| **CA DRE** `secure.dre.ca.gov/datafile/CurrList.zip` | 429,008 | yes | no | no | free | Usable now. Also ships `mlo_list.xls`, a free CA substitute for NMLS |
| **TX TDI insurance** `data.texas.gov/resource/kxv3-diwf.json` | 970,008 | yes | no | no | free | NPN joins to the FL DFS file for a phone |
| **TX TREC** `data.texas.gov/resource/s7ft-44qi.json` | 324,943 | yes | no | no | free | Usable now |
| **FL DBPR real estate** `www2.myfloridalicense.com/sto/file_download/extracts/` | — | yes | no | no | free | Full street address |
| **NY DOS** `data.ny.gov/resource/i8hd-gucs.json` | — | yes | no | no | free | Usable now |
| **CO DORA** `data.colorado.gov/resource/4zse-6bnw.json` | 110,028 | yes | no | no | free | Includes MLOs. City/zip only |
| **GA GREC** | — | yes | no | **yes** | **$200 one-time, postal mail only** | Only bulk source of licensee email besides FL |
| **NMLS B2B** | — | yes | **no** | no | **$85,000/yr daily · $7,000 one-off** | **Dead end — do not buy** |

**The NMLS finding is worth money.** Its paid bulk feed costs up to $85,000 a year and the
`Individual` file contains only NMLS ID and name components — the spec has zero hits for "phone".
The phone appears on the Consumer Access website, one broker at a time, and is deliberately absent
from the product you pay for. Use the free state feeds instead.

Dead ends confirmed: NY DFS insurance (lookup only, nothing on the state portal), NAIC SBS (no
official bulk; the cheap "SBS API" offers circulating online are third-party scrapers), WA DOL
(professional rosters restricted to approved educators and associations — a lead-gen buyer will not
qualify).

### Group 4b — Trades with their own board, separate from the contractor licence

| Source | Rows | Gives | Verdict |
|---|---|---|---|
| **Texas TDLR A/C Contractor (HVAC)** `7358-krk7` | 20,323 | **19,774 (97%) carry a genuine person** `owner_name` ("PETERSON, LESLIE LYNN") | Usable now |
| Texas TDLR Electrical Contractor | 13,917 | `owner_name` | **Dead end** — business-name duplication again |
| Oregon BCD `data.oregon.gov/resource/vhbr-cuaq.json` | 47,959 | plumbing/boiler/electrical, `full_name` is the company | Needs work |

### Group 4c — Childcare: the best category in the entire map

Free, openly licensed, and the only category where three separate states all publish **a real person's
name together with a phone**. Roughly **38,000 callable named contacts** after filtering to active
status. All verified live 2026-09-18.

| State | Source | Rows | Person name | Phone | Licence |
|---|---|---|---|---|---|
| **California** CCLD | `data.chhs.ca.gov` — Centers + Family Child Care Homes CSVs | 19,426 + **19,759** | `licensee` + `facility_administrator` | **100% on homes** | CC-BY |
| **Texas** HHSC | `data.texas.gov/resource/bc5r-88dy.json` | 14,971 | `administrator_director_name` 69% | **99.6%** | **CC0** |
| **New York** OCFS | `data.ny.gov/resource/cb42-qumz.json` | 16,705 | `provider_name` **100%** | 84.3% | NY open data |

Verified California sample:

```
"WAHRENBROCK, CYNTHIA" | Cynthia Wahrenbrock | (760) 872-1998 | Bishop, CA
"AARON, LADASHA"       | AARON, LADASHA      | (925) 753-5765 | Antioch, CA
```

Why this category works: a home daycare **is** the owner. The licensee, the administrator and the
person answering the phone are one human, so the gatekeeper problem that defines every other industry
simply does not exist here. Texas also carries email on 56.5% of rows, and deficiency counts that are
a genuine prospecting angle.

Three cautions before a campaign:
- **Filter status.** CA Centers are 14,072 LICENSED of 19,426; Homes 13,986 of 19,759. The rest are
  closed or pending.
- **CA home addresses are suppressed** — `facility_address` reads `Unavailable` on every home row.
  City, zip and county are present.
- **CA data may lag.** The `file_date` on every row read `05252025`, roughly four months old.
  Re-pull and check before dialling.

### Group 4d — Auto repair

**California BAR is the win, but it gives no owner name.** Two free sources that join cleanly:

- Bulk licensee file via the DCA Box folder — 69,381 rows, **43,863 auto repair dealers, 35,473
  active**, with business name, address and license number. Verified: the `First Name` column is
  blank on **100%** of those rows, so there is no person here.
- `POST https://www.bar.ca.gov/api/autoshoplocator/getards` — no auth, returns `ArdMainPhoneNumber`
  at ~99.4% coverage, and 353 of 358 sampled records joined to the bulk file on licence number.
  Capped at 500 per call, so it must be tiled over a lat/lng grid.

**Open risk: the locator API's terms of use and rate limits for bulk tiling were not verified.** That
is the single biggest unknown on the California plan and must be checked before running it at scale.

**New York DMV** `data.ny.gov` `nhjr-rpi2` — 54,566 rows, **`owner_name` a real person on 100%**,
18,270 repair shops plus 3,441 body shops. No phone. Note `expiration_date` is stored as text, so
date comparisons in the API silently return nothing.

**New Jersey** `data.nj.gov` `t6tk-mr48` — small but 97.7% phone, no owner name. **Texas does not
license general auto repair at all** — confirmed against the full 87-type TDLR list.

### Group 5 — Hybrid, and the hardest: med spas

A med spa is not one licence. Most states require a medical director (MD/DO), the business is often
owned by an RN or NP, and the entity itself is an LLC. Callers are always routed to a front desk.

**Verified 2026-09-18: NPPES has no "Medical Spa" taxonomy.** The API answers a query for it with
`No taxonomy codes found with entered description`. Med spas cannot be pulled from NPPES directly —
they can only be reached by matching a med spa list against NPPES by name and practice address, via
the injector taxonomies (Nurse Practitioner, Dermatology, plastic surgery, family medicine).

**The open risk, and it decides the category.** A cash-pay med spa that bills no insurance may have
no NPI at all. Nobody knows our match rate yet. Per Anas's own rule — nothing gets quoted as a price
until it has been piloted at 300 records — the first action here is to take a known list of ~200 med
spas in one metro and measure what fraction resolve to a named owner. That number decides whether
this category is viable or whether we tell the client honestly that we cannot reach med spa owners
at a sane cost.

Source stack to pilot, best first:

| Source | Access | Gives | Limit |
|---|---|---|---|
| NPPES full file (`download.cms.gov/nppes/NPI_Files.html`) | Free, bulk CSV, monthly + weekly delta | Authorized Official name, title, **AO phone**, legal name, practice address | No med spa taxonomy; coverage unknown |
| Florida Sunbiz bulk (`dos.fl.gov/sunbiz/other-services/data-downloads/`) | Free, true bulk, quarterly + daily delta | Officer/director/member **names and addresses**, registered agent | No phone. FL only |
| CA Medical Board bulk / FL DOH MQA / RI licensee lists | Free bulk downloads | Licensee name + address of record | **Phone usually not published** — a name source, not a phone source |
| Tennessee Medical Spa Registry (`tn.gov/health/licensure/mspa.html`) | Web, export format unconfirmed | Facility + supervising physician name | Only state with a real med spa registry; endpoint returned 403, needs manual check |
| Texas TDLR daily CSVs (`tdlr.texas.gov/LicenseSearch/licfile.asp`) | Free, daily CSV | Esthetician establishment licences | Whether the layout carries owner name and phone is unconfirmed |

Deprioritised: Rhode Island (rules not in force until mid-2026), Indiana (registration starts 2027),
DEA registration (not freely downloadable, and med spas often have none).

The realistic backbone is **NPPES for the person plus Sunbiz for the entity owner**, with Maps as the
contrast. The AO phone in NPPES is the exact structural analogue of the contractor-registry phone.

### Group 6 — No licence exists

AI dev shops · SaaS · agencies · e-commerce · consultants · recruiters

Nothing forces these owners onto a public register. This is Anas's Lane C: Apollo, at 20–40% mobile
coverage and $0.20–0.50 per cell, and the operator must be told that before committing.

## How to find the registry for any state or industry

The Socrata federated catalog searches every US state open-data portal at once:

```
https://api.us.socrata.com/api/catalog/v1?q=<term>
```

That is how every source in this document was found. Before assuming an industry has no registry,
query it there.

## The universal cross-check

Two sources apply to every group and are what turn a single lookup into a three-way match:

1. **Secretary of State entity filings** — members, managers or registered agent. Confirms that the
   name from a licence registry is the same human who owns the company. RESEARCH PENDING on bulk access.
2. **Google Maps** — always available as source C, the contrast that reveals whether the registry
   phone is a bypass or just the main line.

## What this changes in the code

`routeIndustry()` already sorts industries into lanes A/B/C, but the source is hardcoded to Apify.
The change is to make the source a property of the industry+state, not a constant: a resolver that
returns the ordered source stack for a given search, so a Washington roofer starts at the state
registry and a Miami med spa does not.

## Legal check still outstanding

No statutory or terms-of-use review has been done on any dataset here. Florida's files carry plain
public-records language with no stated use restriction, but that is not the same as clearance. Before
any of this is dialled, someone has to confirm that the state does not bar using licensee lists for
solicitation, and how DNC and TCPA apply to these numbers. Anas's compliance section already requires
manual dialing, recipient-timezone calling hours and a permanent suppression list; none of that is
waived by a number being public.

## Economics

| | Maps-first (today) | Registry-first |
|---|---|---|
| Sourcing cost | $0.004 per business | **$0** where an open registry exists |
| Owner name | never | **yes** |
| Phone obtained | advertised business line | the owner's registered line |
| Owner-operator filter | none | **explicit in the data** (WA `Individual`) |

