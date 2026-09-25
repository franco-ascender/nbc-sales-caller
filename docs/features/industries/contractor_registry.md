# Contractor registry — WA, OR, and CA

## Hypothesis

An active contractor register can supply a named license-role candidate and a published business-contact candidate. It cannot by itself establish that the named person owns the business or that the published number is that person's mobile. The route must retain source and role distinctions, compare the register number with the Maps business number, reject shared numbers, and wait for the existing contact/compliance and independent-owner-evidence gates.

## State routes and source evidence

| State | Public source | Candidate extraction | Role interpretation | Phone treatment |
| --- | --- | --- | --- | --- |
| WA | L&I `m8qx-ubtq` | `primaryprincipalname` is parsed only when `businesstypecodedesc = Individual`; LLC/Corp rows retain the business only. | Individual is the strongest implemented candidate route. A principal recorded for an LLC/Corp is not currently persisted as a person and must not be invented as an owner. | `phonenumber` is a register contact candidate; the catalog calls it person-level only for Individual. |
| OR | CCB `g77e-6bhs` | `rmi_name` is parsed; `full_name = rmi_name` is marked Sole Proprietor, otherwise the company is retained. | An RMI is a responsible managing individual, not proof of ownership. A sole-proprietor match is stronger candidate evidence only. | `phone_number` is business-level alongside the RMI. |
| CA | CSLB Master plus Personnel | CLEAR, unexpired Master rows carry BusinessPhone; active Personnel rows carry a person and title, with the phone joined by license number. | Sole Owner, Partner, Member, and certain officer roles are candidate evidence; RMO needs further evidence and RME is held. | `BusinessPhone` remains business-contact evidence even when a Personnel row has a name. |

Sources: `handoff/04_SOURCE_CATALOG.md` rows 15–18; `handoff/07_RESEARCH_BUILD_SPEC.md` sections 4 and final workflow; `src/lib/lead-engine-registers.ts` WA lines 327–345, OR lines 349–366, CA lines 394–472. WA and OR are implemented adapters. CSLB's adapter is implemented, but the source portal was recorded as 503 on 2026-09-21 and its terms remain unverified.

## Bounded code audit

On 2026-09-24, a five-case fixture/code audit inspected the pure adapter paths; it made no provider calls and retained no contact values.

1. A WA active Individual row with a parseable `primaryprincipalname` yields a named `Principal` candidate and the register phone.
2. A WA active LLC/Corp row yields the business without a named person; it cannot become an owner candidate from the stored name row.
3. An active OR row where `full_name` equals `rmi_name` yields a named `RMI` and `Sole Proprietor` business type; this is candidate evidence, not an owner confirmation.
4. An active OR company row with a different RMI yields an `RMI` candidate and business-level phone; it must pass the role and owner-evidence holds.
5. A CLEAR, unexpired CA Personnel RME row yields the named `RME`; service code joins the Master `BusinessPhone`, so the number must remain business-contact evidence and the role is held.

The audit confirmed the branches above, not mobile status, reachability, DNC/TCPA status, phone ownership, source terms, or an outcome rate. Sample n=5; verified phones=0.

## Failure cases and correction

- **Owner-role inflation.** An RMI, RMO, officer, or primary principal is not automatically an owner. Retain role provenance, hold RME and unsupported roles, and require independent owner evidence before an owner label.
- **Business-phone inflation.** CA's `BusinessPhone`, OR's `phone_number`, and a WA register contact can be an office or dispatch number. Equal or different Maps numbers are only contrast evidence.
- **Phone reuse.** The configured `PHONE_REUSE_MAX = 3` is useful, but the implemented reuse count is calculated only inside the same register source (`lead_engine_names_reuse(p_source)`). It cannot reject one shared phone appearing across WA, OR, CA, Maps, or permits.
- **Stale and inactive records.** WA filters active status, OR filters future expiration, and CA filters CLEAR plus future expiration. A matching live Maps listing or permit/activity evidence is still needed before outreach.
- **CA portal/terms uncertainty.** The adapter explicitly parks when CSLB returns the recorded portal rejection. Do not substitute a paid list or claim commercial-use clearance.

### Material runtime defect reported to root

`selectRegisterNames` in `src/lib/lead-engine-jobs.ts:213` rejects a number using `reuse_count`, while `lead_engine_names_reuse(p_source)` in `supabase/migrations/202609210250_lead_engine_registers.sql:124` counts only rows with that one `source`. This does not implement the research requirement to count reuse across all registers, Maps listings, and permit rows. A shared answering-service or franchisor line can therefore survive when it appears once in each source.

The safe correction is to calculate a global, distinct-business/person phone-frequency signal before bucket assignment or verification, including register names, matched Maps listings, and permit contacts. Hold a phone above the documented threshold; retain only the identity candidate for later authorized append. Do not infer a person-phone edge from a register row while this evidence is absent.

## Implementable free correction

Keep the existing adapters and add a global phone-frequency gate to the jobs/bucket path. It should use only already-ingested public-business contact data, preserve state/source provenance, and produce a hold reason for a cross-source shared line. Add a synthetic test with the same phone on one WA, one OR, one CA, and one Maps/permit record; the phone must be held before paid verification while the identities remain available for review.

## Remaining measurement

After authorization and source-term confirmation, run a bounded aggregate field-coverage pull for each state and then a separately denominated outcome study: active rows, named role candidates, exclusive register phones, Maps-match buckets, mobile/live/DNC-cleared contacts, reached people, independently confirmed owners, and delivered contacts. No clean-contact cost or owner-mobile rate is asserted here.
