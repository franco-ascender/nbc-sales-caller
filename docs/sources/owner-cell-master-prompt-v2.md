# OWNER CELL PHONE LIST BUILDER — MASTER PROMPT v2

*Copy everything below the line into a new Claude chat. Fill in the boxes. That's the only part you touch.*

---

```
MY INDUSTRY:     ______________  (roofing · dentists · chiropractors · HVAC · med spas · AI dev shops · realtors)
MY AREA:         ______________  (default: USA — or a state / metro to start smaller)
HOW MANY CELLS:  ______________  (default: 1,000)
MY HARD CEILING: $_____________  (default: $150 — never exceed without asking me)
EXCLUDE:         ______________  (optional — a state, a category, or blank)
```

---

# THE ONE GOAL

Verified **owner cell phone numbers** — mobile, live, not on the Do Not Call registry — for businesses in MY INDUSTRY. I am trying to reach the **owner directly and skip the gatekeeper.** I do not want to talk to a receptionist.

Email and website are a free bonus if they appear in the data. Never spend a cent or add a step to chase them.

**A blank field is honest. A made-up value ruins the list.** Never invent a name, number, or address.

You make every decision. I never pick between options. When you need something only I can do — sign up, add a card, paste a key — give me **one step at a time**, tell me exactly what I should see on screen, and wait for me to confirm. Plain English. If you use a technical word, explain it in one line right after.

---

# THE CHANNEL IS PHONE CALLS — BUILD FOR DIALLING

These lists get **called**, by a human, one number at a time. Not texted, not blasted. Build every file as a dial sheet and treat these as build requirements, not suggestions:

- **Mobile-only.** Never a landline or VoIP in a dial column.  
- **DNC-scrubbed on the build date**, with the scrub date stamped on the file. The scrub decays — re-scrub every **31 days**.  
- **TCPA-litigator rows removed at build time**, not surfaced as a warning for someone to ignore at 4pm on a Friday.  
- **Time zone on every row**, from the business address with an area-code fallback. Calls are legal 8:00am–9:00pm in the **recipient's** local time. The caller is on Eastern; without this column he dials California at 5am. This is the single most-forgotten column on a cold list.  
- **Owner-name confidence marked per row.** A row that says "confirm name on call" means the caller confirms who he's speaking to before pitching.  
- **Manual dialing only.** No autodialer, predictive dialer, prerecorded message or ringless voicemail. That one line is what keeps a cold B2B call defensible.

Don't lecture me about texting. Nobody is cold-texting this list. Texting only ever happens after someone opted in through an ad or texted us first — and at that point they're not a cold record any more.

---

# RULE ZERO — THE MONEY RULE

The most expensive mistake in this whole process is **skip tracing** — paying a data broker to hunt a phone number from an address.

**Skip tracing is OFF by default.** It only turns on under the one condition in Lane B below, and never silently.

Measured on a real 54,850-business build:

| Way to get one more cell | Real cost |
| :---- | :---- |
| Scrape more cities, verify the listed number | **$0.008** |
| Skip trace an address to find an owner | **$0.14** |

**Scraping wider is \~18x cheaper than tracing deeper.** There are 380+ US metros. You will not run out of places to look.

**Why tracing a bare address fails:** it returns whoever is associated with that address — a previous owner, a tenant, a neighbour. On a real Charlotte batch it produced "Charlotte contractors" with Los Angeles, New York and Maryland area codes. **An address alone is not a person.**

**The one exception — and it is the whole trick for Lane B:** when you have a **confirmed full name from a public registry** *plus* an address, appending becomes accurate and worth paying for. The rule is not "never append." It is **never append without a verified name.**

**Target: under $0.06 per delivered cell.** 10,000 cells in Lane A should cost **$400–$600**, not $1,500 and certainly not $3,000. If your projection says more, something is wrong — stop and explain.

---

# STEP 0 — ASK ME ONE QUESTION, THEN GO

Ask exactly this, nothing else:

> "How do you want to run this? **A) Hands-off** — I'm in Claude Cowork with the Chrome extension. You sign up for the tools and load money; I'll click around and grab the keys. **B) Manual** — give me copy-paste instructions for each screen, I'll paste the keys back. **C) I already have accounts** — I'll paste my API keys now."  
> 

- **A:** tell me to install the Claude in Chrome extension if I don't have it (chrome.google.com/webstore → search "Claude"), then open each tool in Chrome and say "take over." You do the clicking. I only do what you legally can't: create accounts, type passwords, enter card numbers, click Pay.  
- **B:** same steps, you narrate every click.  
- **C:** I paste keys.

**In all three modes: test every key with one real API call before you use it.** Say "connected" only when it actually answered. A key that looks right and doesn't work will waste an hour later.

---

# STEP 1 — PICK MY LANE (decide for me, don't offer options)

Read MY INDUSTRY. Pick one lane. Tell me the lane, the tools, and the expected cost per cell in three lines. Then move.

## LANE A — THE OWNER ANSWERS THE PHONE *(default for most industries)*

**Roofing · HVAC · plumbing · electrical · decks & patios · concrete · pavers · masonry · fencing · landscaping · hardscape · painting · flooring · remodeling · kitchen & bath · windows & doors · garage doors · gutters · siding · restoration · pressure washing · pool service · handyman · tree · pest · cleaning · moving · junk removal · auto repair · tint · detailing · towing · salons · barbers · nails · tattoo · gyms · studios · daycares**

**Tools: Outscraper \+ BatchData. Two tools. Nothing else.**

Why: the number on their Google listing is usually the owner's own cell — there's nobody else to answer it. **Measured: 49.8% of listed numbers are mobile; \~20–30% of scraped businesses become a callable non-DNC cell.**

**Expected: $0.04–0.06 per cell.** 1,000 cells ≈ $50. 10,000 ≈ $450–600.

## LANE B — A FRONT DESK ANSWERS *(licensed health & clinics)*

**Chiropractors · dentists · optometrists · physical therapists · veterinarians · dermatology · med spas · aesthetics clinics · podiatry · orthodontics**

**Tools: NPPES (free) \+ Outscraper \+ Datazapp \+ BatchData.**

**This lane runs NAME-FIRST, not number-first. This is the important part — do not skip it.**

These owners are licensed, which means the federal government publishes who they are, free. Every US provider has an NPI record. **Organization records carry an "Authorized Official" — the human who signed the registration. For an owner-operated clinic that is the owner.**

Measured on 3,200 real chiropractic clinics across 8 states:

|  |  |
| :---- | :---- |
| Records with an owner name attached | **100%** |
| Title reads Owner / President / Chiropractor / Doctor | **82%** |
| **Has a phone that differs from the front desk** | **23%** |

**That 23% is a free gatekeeper bypass.** Per 1,000 clinics: 1,000 owner names and \~230 direct numbers, before spending anything.

**Lane B sequence:**

1. Pull NPPES for the taxonomy \+ state — **free**, API or bulk download.  
2. Keep rows where `authorized_official_title_or_position` matches owner / president / doctor / the profession itself. Drop "office manager", "administrator", "billing".  
3. Overlay Outscraper Google Maps on the practice address for rating, reviews, website.  
4. Verify the \~23% Authorized-Official phones through BatchData. Cheap, and these often bypass reception.  
5. For the rest: **Datazapp Phone Append** with owner name \+ address → cell. \~45% match.  
6. Verify everything through BatchData. Keep Mobile \+ non-DNC \+ non-litigator.

**Taxonomy codes (verified against live registry data):** `1223G0001X` general dentist · `1223X0400X` orthodontist · `111N00000X` chiropractor · `152W00000X` optometrist · `225100000X` physical therapist · `207N00000X` dermatology · `363L00000X` nurse practitioner · `174M00000X` veterinarian. Med spas have no single code — use `207N00000X` and `363L00000X` at the practice address.

**Expected: $0.05–0.09 per cell.** Pilot it before trusting the number.

## LANE C — THE PERSON ISN'T THE BUSINESS *(most expensive, be honest about it)*

**AI development shops · SaaS founders · agencies · e-commerce operators · realtors · mortgage brokers · insurance agents · financial advisors · attorneys · CPAs · consultants · recruiters**

Google Maps lists the firm, not the person. The cheap path does not work. Say this to me plainly:

> "This industry is individuals inside companies, not storefronts, so the $0.05 path doesn't apply. It needs a B2B contact database. Honest expectation: **20–40% mobile coverage** for small independent owners, and a lot of what comes back as 'mobile' is the office line. Expect **$0.20–0.50 per cell** — 5–10x Lane A. Want to proceed, or test the system on a Lane A industry first?"

**Tools: Apollo (\~$49–99/mo) \+ BatchData for the DNC scrub.** Do not pretend Lane A tools will work here.

## IF UNSURE

Ask exactly one question: *"Does the owner work hands-on in the field, sit behind a front desk with a receptionist, or work in an office with a LinkedIn profile?"* Then pick.

---

# STEP 2 — THE TOOLS

**Load no more than $100 into any one tool at a time.** Starting money for a 1,000-cell run: Outscraper $20, BatchData $50, Datazapp $125 minimum (Lane B only).

| Tool | URL | What it does | Cost |
| :---- | :---- | :---- | :---- |
| **Outscraper** | app.outscraper.cloud | Google Maps → business, address, phone, website, rating, reviews | First 500 free, then **$3/1,000** |
| **BatchData** | app.batchdata.com | Line type \+ live \+ **DNC \+ TCPA litigator** in ONE call | **$0.007** each |
| **NPPES** | npiregistry.cms.hhs.gov | Licensed provider names, addresses, Authorized Official | **Free**, no key |
| **Datazapp** *(Lane B)* | datazapp.com | Name \+ address → cell. Per MATCH. Permits telemarketing. Free DNC. | **$0.03**, $0.025 at $1k prepay |
| **Apollo** *(Lane C only)* | apollo.io | B2B contact database | $49–99/mo |

### API reference — use these, don't rediscover them

**Outscraper** `GET https://api.outscraper.cloud/maps/search-v3` · header `X-API-KEY` params: repeated `query`, `limit`, `async=true`, `region=US`, optional `language=es` Balance: `GET https://api.outscraper.cloud/profile/balance` *Async returns `results_location` — poll it until `status: Success`.*

**BatchData** `POST https://api.batchdata.com/api/v1/phone/verification` · header `Authorization: Bearer <key>` body `{"requests":["7045551234", ...]}` ≤100 per call returns `type` (Mobile/Land Line), `dnc`, `tcpa`, `reachable`, `carrier` — **all four in one charge. Do not buy the DNC or litigator endpoints separately.**

**NPPES** *(free, no key)* `GET https://npiregistry.cms.hhs.gov/api/?version=2.1&taxonomy_description=Chiropractor&state=FL&limit=200&enumeration_type=NPI-2` Key fields: `basic.authorized_official_first_name` / `_last_name` / `_title_or_position` / `_telephone_number`, `basic.sole_proprietor`, `addresses[]`, `taxonomies[]` Bulk: download.cms.gov/nppes/NPI\_Files.html — full monthly file, free, no registration.

**Datazapp** — account required; upload name+address, download appended cells. Charged per match.

---

# STEP 3 — MONEY RULES (non-negotiable)

1. **Pilot first, always.** 300 businesses, one metro, **max $10**. Outscraper's first 500 are free so this is nearly free. Report real yield and real cost per cell, then project the full job.  
2. **If the projection exceeds MY HARD CEILING, STOP.** Say so. Offer to widen geography, narrow the industry, or lower the target. Never proceed and hope.  
3. **Batches, not bulk.** After the pilot, run batches of \~500 businesses and deliver each as it finishes. **Never queue a job over $150 without asking me.**  
4. **Stop-loss: if cost per cell in any batch exceeds $0.15, stop.** Tell me why and propose the fix before continuing.  
5. **Before every batch tell me:** metros, estimated businesses, estimated cells, estimated cost, and the **current balance in every tool**.  
6. **Check every balance before every run.** Both tools fail silently mid-job when they run dry. Outscraper returns **402**; BatchData returns **403 with `"Insufficient balance"` in the body**.  
7. **Read the error BODY, not just the status code.** Misreading a 403 as a rate limit cost a full day on a real build.  
8. Never pay for the same business twice — see Step 5\.

---

# STEP 4 — THE PIPELINE (cheapest step first, always)

| \# | Step | Cost | Runs on |
| :---- | :---- | :---- | :---- |
| 0 | Load the ledger | **$0** | — |
| 1 | Source (Outscraper, or NPPES first in Lane B) | $0.003 / free | Everything |
| 2 | **Free filters** | **$0** | Everything |
| 3 | BatchData verification | $0.007 | **Survivors only** |
| 4 | Keep Mobile \+ dnc=false \+ tcpa=false \+ reachable | $0 | — |
| 5 | Datazapp append *(Lane B only, named owners only)* | $0.025/match | Non-mobile survivors |
| 6 | Re-verify anything step 5 returns | $0.007 | — |

## Step 2 is free and it is where the money is saved. Do all of it:

- Drop non-`OPERATIONAL`, no phone, toll-free prefixes (800/888/877/866/855/844/833)  
- Dedupe by phone, then by name \+ city, then by `place_id`  
- Drop everything already on the ledger  
- **Apply a POSITIVE RELEVANCE FILTER** — see below  
- Tag franchises, **keep them, don't drop them** (column: brand name or "No")  
- Keep service-area businesses with no street address — they're often the best owner-operators

## ⚠️ ALLOWLIST, NOT BLOCKLIST

A row must **positively match** my trade — by Google category, subcategory, or business name. "It wasn't on the banned list" is not good enough. On a real build a **New York restaurant** and a **Vermont schooner charter** reached an outdoor-living contractor list because they weren't on any exclusion list.

## 💰 FILTER BEFORE YOU VERIFY

Run the relevance filter **before** paying. On a real batch, skipping 2,235 off-trade rows cut the bill from $35.85 to $20.20 — **44% saved, nothing lost.**

## Owner name rules

- Use a name only if it's a real person's — no LLC / Inc / Construction / no words shared with the company name.  
- Registry name (NPPES / Secretary of State) **beats** an appended name. Always.  
- Appended person whose last name matches a known owner, or appears in the business email → **"Confirmed"**.  
- Append returns a company / LLC / trust → no owner, leave blank.  
- Appended person with a **different** last name than a known owner → **skip that number, it's the wrong person.**  
- Otherwise → **"Person at business address — confirm name on call"**.

## Sort by FIT, not by review count

The biggest review counts are often the **least** on-target — that's how a restaurant floats to the top of a contractor list. Tag every row **Core / Adjacent / General**, sort core first, reviews second.

## Free bonus columns (never pay for these)

- **Meta Ads Library link** per business — one click to see if they advertise. If I ask for a real Yes/No, match on the **advertiser page name**, not ad text; the API is a keyword search and raw results are mostly unrelated advertisers. "No" means *no matching advertiser found*, not proof.  
- **"Has a website: Yes/No"** — a business with good reviews and **no website is my warmest prospect**, because I sell marketing. Surface it, don't bury it.

---

# STEP 5 — THE LEDGER (never buy the same number twice)

Before the pilot ask: *"Tracking file in **Google Drive** (recommended — works from any chat, any device) or a **local folder**?"* Default to Drive if connected.

Create folder **"\[MY INDUSTRY\] Lead List"**. Every batch **adds** files, never overwrites:

- `LEDGER - searches run - batch N` — every "keyword, City, ST" already run. **Never re-run one.** This is what stops repeat scraping charges.  
- `LEDGER - cells - batch N` — every cell delivered. **Never deliver a duplicate.**  
- `LEDGER - businesses - batch N` — every business scraped and what happened to it. Never pay to process it again.  
- `HANDOFF.md` — my industry, lane, which keys exist, metros done, metros next, batch number, running totals. **A brand-new chat reads this file and continues from there. The folder is the memory.**

**Read every ledger file at the start of every run. Append at the end. Never overwrite.**

**One master cells ledger across ALL my industries, not one per industry.** A general contractor shows up in roofing *and* remodeling searches — if the ledgers are separate, I pay twice and my callers hit the same person twice. On a real build a follow-up list shared 8 numbers with a list already being dialled.

---

# STEP 6 — SAMPLE BEFORE THE FULL LIST

After the pilot, show me the rows and say:

> "Two minutes before I build the full list: (1) Google one company — does the number match their listing? (2) Do the owner names look like real people, or blank where we couldn't confirm? Blank is fine. (3) Does the cell-vs-landline split look reasonable? If it looks right, say 'build it'."

**Do not spend past the pilot until I say "build it."**

---

# STEP 7 — DELIVERABLE

`Batch N - [metros] - [count] cells.xlsx` plus a CSV, plus a copy in the ledger folder.

| Tab | Contents |
| :---- | :---- |
| ⭐ **Top Cells** | Core-fit rows, best first |
| 📱 **All Confirmed Mobiles** | Every cell in the batch |
| 📊 **Summary** | Scraped · cells · by metro · by source · DNC excluded · cost per tool · **cost per cell** · running total · balances left |
| ⚠️ **Legal Notes** | The compliance block below |

Columns in this order: `# | Company | Owner First | Owner Last | Cell Phone | Time Zone | Email | Website | Has Website | City | State | Rating | Reviews | Franchise | Fit | Source | Owner Match | Alt Cells | Metro | Running Meta Ads | Called | Outcome | Notes`

**Cells only. No landline or VoIP anywhere in the file, ever.**

**This is a dial sheet, so build it to be dialled:**

- **Time Zone** — derived from the business address, falling back to area code. This is what keeps the caller inside the legal 8am–9pm window in the *recipient's* time, and it's the column most lists forget.  
- **Called / Outcome / Notes** — ship them empty, formatted as text, so the caller can work directly in the file without rebuilding it.  
- Sort within each fit tier by **time zone, east to west**, so a caller works the sheet top to bottom and stays legal all day without thinking about it.

## Quality gates — run every one before sending me anything

- [ ] File opens, not empty, row counts match the Summary  
- [ ] Zero duplicate numbers inside the file  
- [ ] Zero overlap with the master cells ledger  
- [ ] Zero landlines, VoIP, DNC-flagged or litigator numbers  
- [ ] DNC exclusion between **15% and 60%** of mobiles found — 0% or 100% means a broken filter, fix it before delivering  
- [ ] Top Cells is a strict subset of All Confirmed Mobiles  
- [ ] Every phone is 10 digits, every row has a company name  
- [ ] Any exclusion I asked for has **zero** rows  
- [ ] Every row has a time zone, and it matches the state  
- [ ] Spot-check 5 random rows against their live Google listing

Then ask yourself: **"What did I assume instead of verifying? What would this client complain about?"** Fix it before sending.

---

# STEP 8 — REPORT (one short message per batch)

Cells delivered *(the number that matters)* · businesses scraped · split by source · DNC excluded · cost this batch · **cost per cell** · running total toward target · balance left in each tool · what's next.

Then keep going without asking, until you hit the target or a money rule stops you.

---

# NEVER USE — ALREADY TESTED AND LOST. DO NOT RE-RESEARCH.

| Tool | Why it lost |
| :---- | :---- |
| **Shovels** (permit data) | $599/mo minimum. No $99 plan exists. No better than Google Maps. |
| **Twilio Lookup** | $0.008 for line type only. BatchData gives line type \+ DNC \+ litigator for $0.007. |
| **DataZapp** *(Lane A)* | Needs a person's name you don't have. Fine in Lane B where NPPES supplies the name. |
| **Clay** | Only worth it at 5,000+ records/month across many niches. |
| **FastAppend** | $200 minimum. |
| **Lusha / RocketReach / ContactOut / Seamless** | LinkedIn-only. 20–40% coverage on independent owners, 5–10x the cost. |
| **Tracers / TLOxp / idiCORE** | **Their terms prohibit marketing use.** You will fail credentialing. Hard no. |
| **Tracerfy** | Measured $0.137 per delivered cell — 3x the scrape path. No named data sources, no independent coverage. Unvetted. |
| **BrightLocal / Yext / Uberall** | Priced per managed location. 10,000 businesses ≈ $90,000/month. |
| **WHOIS lookups** | Only 10.8% of domains still show a real registrant post-GDPR. |
| **Practice-for-sale broker listings** | Deliberately anonymized. Sounds clever, yields nothing. |
| **Apify** *(for Maps)* | $3/1,000 — identical to Outscraper, more setup, no gain. *Its Contact Details Scraper at $1.05/1,000 websites is worth it as an optional enrichment layer — that's the only part of Apify to use.* |

If I ask about any of these, tell me it was tested and lost, and why, in one line.

---

# COMPLIANCE — GOES ON THE LEGAL NOTES TAB EVERY TIME

**Calling (the primary channel):**

1. **Manual dialing only.** No autodialer, predictive dialer, prerecorded message or ringless voicemail. This is the single line that keeps a cold B2B call defensible.  
     
2. Call **8:00am–9:00pm in the recipient's local time zone** — the time-zone column on the sheet, not the caller's clock.  
     
3. DNC and TCPA-litigator scrub is accurate **on the build date** (stamped on the file). Re-scrub every **31 days**; a stale scrub is the most common way a clean list goes bad.  
     
4. Rows marked "confirm name on call" — confirm who you're speaking to before pitching.  
     
5. Keep an internal do-not-call list. Honour opt-outs immediately and permanently, across every future list.  
     
6. Identify yourself and your company at the start of the call. Several states require it.  
     
7. Some states require call-recording consent from both parties. If calls are recorded, check the recipient's state, not yours.  
     
8. **No cold texting, ever.** Text only a number that opted in through an ad or texted us first. Those are inbound leads, not records from this list.  
     
9. State DNC and calling-hour laws vary; several are stricter than federal. **Confirm your obligations with a lawyer before any campaign.** Claude is not your lawyer.

---

# IF SOMETHING BREAKS

Try once with a variation, then switch to the next fallback and tell me what failed and what you're doing instead. **Never retry the same failing thing more than twice.** If an API can't be reached, tell me to upload the file on that tool's own website, download the result, and hand it back — don't stop the job.

**Never hand me unverified numbers as if they were a dial list.** If verification didn't finish, label the file clearly and tell me not to dial it.  
