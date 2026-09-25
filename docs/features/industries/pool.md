# Pool industry workflow review

Reviewed 2026-09-24. The live brain routes `pool` to recipe A with the single Maps keyword `pool builder`. That historical route has `expected_clean` 0.18 and `n` 200, retained in the live brain. It does not establish an owner, a mobile line, or a clean delivered contact, and it does not represent the whole meaning of the word “pool.”

## Hypothesis

Pool construction/builders, pool-service operators, pool-equipment or supply retailers, and hot-tub/spa retailers are different populations. A licensed pool-construction record can provide a qualifying-person candidate where a legally eligible state source exists. A pool-service business generally needs a service-specific Maps identity path. Retail and hot-tub/spa listings should not enter either route merely because their listing contains `pool` or `spa`. In every branch, a public business phone is a business-contact candidate until the existing mobile, live, DNC, suppression/dedupe, and independent owner-evidence gates pass.

## Bounded code-audit observation

No verified, pool-specific public endpoint already wired to the runtime was suitable for a contact sample without first changing shared routing. I therefore performed a five-label synthetic code audit of `src/lib/lead-engine-industries.ts` on 2026-09-24. The labels were test inputs only; they are not business records and no contact values were collected.

| Synthetic label | Live relevance result | Required treatment |
| --- | --- | --- |
| `Acme Pool Builders` | core | Pool-construction candidate; use a licensed-trade route where supported. |
| `Acme Pool Service` | core | Pool-service candidate; retain the service route. |
| `Pinch A Penny Pool Patio Spa` | core | Retail/franchise candidate; do not classify as service or construction without evidence. |
| `Acme Hot Tub Store` | adjacent | Retail candidate; hold/reject from service and builder routes. |
| `Acme Day Spa Wellness` | core | Off-industry wellness listing; reject. |

The audit shows that `spa` is a core pool term and that construction, retailer, and service semantics are not separated. `franchiseBrand()` also returns no brand for the retailer input even though `src/data/lead-engine-brands.json` contains `pinch a penny`, `poolwerx`, and `pool scouts` in `lawn_landscape`; the generic Maps flow calls `isChain`, while this relevance helper has a separate, smaller hard-coded list. This is code/fixture evidence only, not a measurement of mobile rate, ownership, reachability, DNC clearance, or delivery. `verifiedPhones` is zero.

## Workflow

1. Classify the business into pool construction/builder, pool service, pool/hot-tub retail, or unrelated wellness spa before owner/contact processing.
2. For construction, allow a legally eligible active contractor source only when its pool class is explicit: CA CSLB `C-53` or FL DBPR `CPC` are catalogued examples. Preserve the licensee or qualifier as an owner candidate, not owner confirmation.
3. For pool service, retain core service discovery and reject builder-only, retail-only, franchise, lead-generation, and unrelated spa/wellness matches unless a later product policy explicitly segments them.
4. For retail/hot-tub, hold/reject from this workflow. A store’s published phone is not evidence of an owner-operated service business.
5. Match the retained candidate to the business listing and reject duplicate, stale, multi-location, or mismatched records. The construction and service branches must not be merged by a broad `pool` token.
6. Run the existing mobile, live, DNC, suppression/dedupe, and owner-evidence gates. Deliver only the contact classification the evidence supports.

## Pool-specific failures and correction

| Failure | Mitigation | Status |
| --- | --- | --- |
| Recipe A begins every pool request with `pool builder`, excluding service queries while including construction listings. | Add an explicit subvertical selector or classifier, then route builders and service businesses separately. | Runtime correction needed |
| `spa` causes day spas/wellness listings to pass as core pool relevance. | Remove bare `spa` from the pool-service core terms; require pool context for any spa term. | Runtime correction needed |
| Pool construction is classified as adjacent in the service profile despite an available licensed-trade path. | Add a construction branch with explicit CA `C-53`/FL `CPC` class filtering only after adapters expose a usable class field. | Proposed |
| Pool retailers, hot-tub stores, and pool-supply franchises can be treated as service leads. | Hold/reject retail and hot-tub branches; classify franchises separately before contact work. | Runtime correction needed |
| The generic franchise helper recognizes only Pool Scouts while the shared chain data contains additional pool brands. | Use the shared `isChain` result consistently, or synchronize one authoritative pool brand set; preserve franchise as a segment rather than owner proof. | Partial |
| A contractor qualifier or public business line is labeled as an owner mobile. | Preserve role and line provenance; require the existing contact and independent owner-evidence gates. | Existing gates; unimplemented pool branch |

## Sources

| Source | Evidence and use | Status |
| --- | --- | --- |
| Live pool brain route | `src/data/lead-engine-brain.json` has recipe A, keyword `pool builder`, historical `expected_clean` 0.18, `expected_any` 0.35, and `n` 200. | Implemented; insufficient subvertical routing |
| Pool relevance and franchise helpers | `src/lib/lead-engine-industries.ts` is the audited classifier; `src/lib/lead-engine-brands.ts` and `src/data/lead-engine-brands.json` provide generic chain filtering. | Implemented; classification/brand coverage partial |
| CA CSLB Master plus Personnel | VERIFIED catalog record. `C-53` is the pool class; personnel titles and business phone need role/contact gates. Portal terms were UNKNOWN after documented 503. | Adapter exists; no pool mapping/filter |
| FL DBPR contractor extracts | VERIFIED catalog/build-spec record. `CPC` is the pool class and the qualifier is a person candidate. The implemented `fl_dbpr_construction` adapter documents no phone column, so it is identity-only in current runtime. | Adapter exists; no pool mapping/filter |
| Pool-service/franchise research | REPORTED pool franchise list in `handoff/07_RESEARCH_BUILD_SPEC.md` section 6 attack 4; it names Pool Scouts, ASP, Pinch A Penny, and Poolwerx. | Partial shared-brand coverage |

## Iteration and remaining measurement

The live entry assumed one Maps query could represent pool. The code audit falsifies that assumption at the relevance layer: it cannot distinguish builders, service operators, retailers, hot-tub stores, and wellness spas. The correction is a branched subvertical classification before any contact is treated as an owner candidate; it is not a claim that a construction license or Maps phone is a direct owner mobile.

The next bounded free test should use synthetic source rows and listing labels for a CA `C-53` builder, FL `CPC` qualifier, independent pool-service operator, Pinch A Penny retailer, hot-tub store, and day spa. It must prove that only the builder/service branches survive, that a qualifier remains an owner candidate, and that no route emits an owner-confirmed contact. A later authorized outcome experiment must separately measure line type, reachability, DNC clearance, reached-owner, and delivered denominators. No per-clean cost is established.

## Runtime defect for shared-owner review

`src/lib/lead-engine-industries.ts` defines one `pool service` profile in which `pool`, `pools`, and bare `spa` are core terms, while `pool construction` and `hot tub` are only adjacent. `src/data/lead-engine-brain.json` independently routes the `pool` industry through recipe A using only `pool builder`. Consequently the runtime simultaneously over-admits unrelated spas/retailers and fails to make an explicit pool-service route; it cannot honor construction licenses as a distinct branch. Add a pool subvertical classifier (builder, service, retail/hot-tub, reject), remove bare `spa` as core, and require explicit license-class fields before mapping CA `C-53` or FL `CPC` to construction. Regression fixtures should cover all six labels above before changing the live brain.

## Root integration regression check, 2026-09-24

Bare spa was removed from pool relevance. Wellness-only examples now fail while actual pool maintenance/construction still pass. Separate builder/service routing is still proposed.

Focused synthetic regression checks passed; no paid phone test or uplift measurement was performed. Earlier defect observations above are historical where this correction supersedes them.
