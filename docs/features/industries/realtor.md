# Realtor industry workflow review

Reviewed 2026-09-24. The live brain routes `realtor` to recipe B with state register mappings for FL, TX, AZ, IL, and PA. That is wired runtime behavior, but recipe B is a residential parcel and paid skip-trace route. This review does not use or recommend that route: a licence address may be residential, and a licensed broker is a candidate rather than proof of brokerage ownership or a direct phone.

## Hypothesis

An active real-estate register can provide lawful business identity evidence when it explicitly links a brokerage to a designated broker or distinguishes an independent broker from a sales associate. It cannot establish that the broker owns the brokerage, owns a handset, or has consented to contact. Until a public business-contact source is separately eligible and normal contact gates are available, the safe result is an identity candidate held from delivery.

## Bounded free observation

I queried the catalog's VERIFIED Texas TREC Socrata endpoint (`s7ft-44qi`) on 2026-09-24 for five active `Broker Company` records. The query requested only licence type, status, full name, related designated-broker name, and original licence date. Aggregate-only inspection found all five records had each requested field. No names, licence numbers, addresses, or contact values were retained.

This confirms five selected records carry a company-to-designated-broker identity link and recency field. It does not measure broker ownership, business activity, mobile status, reachability, DNC status, phone exclusivity, or delivery. TREC publishes no phone in the catalog entry, so `verifiedPhones` remains zero.

## Workflow and failure cases

1. Apply the state legal gate before using a licence list. SC and UT are prohibited list sources; do not substitute their records into this workflow.
2. Read an active broker-company, independent broker, or equivalent explicitly scoped register row. Reject sales associates, inactive licences, and corporations without a named person link.
3. Preserve the relationship as `designated broker`, `independent broker`, or `managing broker`; none is automatically an owner-confirmed identity.
4. Match only to an exact public business presence where a permitted public business-contact source is available. A company-name or city-only match is held.
5. Hold every case without independent ownership evidence and a permitted public business contact. Do not resolve licence or property addresses to a private number.
6. A future authorized contact path would still need contact-type, live, DNC, suppression, dedupe, and owner-evidence gates before any delivery.

| Failure | Safe handling | Runtime state |
| --- | --- | --- |
| Broker company names a designated broker, who may be an employee or compliance representative. | Store the role as identity evidence only; require independent ownership evidence. | Proposed |
| Individual brokers, managing brokers, and sales associates are treated alike. | Restrict source rules by active licence type and retain exact role code. | Partial: adapters filter types but do not prove ownership. |
| Florida licence addresses are often residential. | Do not use licence addresses for parcel matching, tracing, or private-number lookup. | Not implemented: recipe B can trace these rows. |
| A phone on a public listing is labelled the broker's direct mobile. | Treat it as a business-contact candidate until independently supported and normal gates pass. | Proposed |
| SC or UT licence-list restrictions are bypassed by generic Realtor routing. | Enforce prohibited state gate and hold the register route. | Wired in `route`; no Realtor-specific test observed. |

## Sources and implementation status

| Source | Evidence and scope | Status |
| --- | --- | --- |
| TX TREC `s7ft-44qi` | VERIFIED, free Texas licence data. Active broker-company rows name a designated broker; no phone field in the catalog. | Implemented adapter; unsafe recipe-B downstream route. |
| FL DBPR regional real-estate CSVs | VERIFIED, active BK rows distinguish empty-employer independent brokers; addresses are often residential and no phone is listed. | Implemented adapter; unsafe recipe-B downstream route. |
| AZ ADRE / IL IDFPR | AZ is UNKNOWN in the catalog's grouped source row; IL IDFPR is VERIFIED identity-only for managing brokers. | Implemented adapters, proposed safe business-contact workflow. |
| PA PALS mapping | Present in the live brain but no corresponding adapter appears in `src/lib/lead-engine-registers.ts`. | Blocked. |
| NY DOS, CA DRE, CO DORA | VERIFIED free identity registers in the catalog; none is a live Realtor mapping or approved public-contact route here. | Proposed. |
| SC LLR and UT DOPL | VERIFIED restricted commercial-list terms. | Blocked by state policy; no list use. |

`src/lib/lead-engine-brain.ts` wires Realtor to recipe B and selects its state name source. `src/services/lead-engine-jobs.service.ts` then advances recipe-B rows through `parcelStep` and `traceStep`; `homeStreetSource` specifically classifies `fl_re` as carrying a home street. Those stages are implemented, but are not suitable for this review's public-business-contact scope. The safe workflow above is proposed and no safe delivered-contact route is wired.

## Iteration and remaining measurement

The starting premise was that a real-estate licence route could identify business-owner contacts. The five-row TREC observation supports only an identity relationship on its selected broker-company rows. The correction is to hold that identity candidate and block recipe-B parcel/trace progression for Realtor jobs, rather than treating licence addresses or a designated-broker relation as owner-contact evidence.

The remaining free test is a five-case synthetic job test: active broker company with a designated broker; inactive company; sales associate; FL independent BK carrying a street; and SC/UT restricted-state row. It should retain only eligible active identity candidates, preserve roles, and hold all five before parcel or trace. A separately authorized public-business-contact experiment can then measure identity-to-business match coverage, candidate contact coverage, and contact-gate outcomes with distinct denominators. No clean-contact cost is established.

## Runtime correction for shared-owner review

In [`src/services/lead-engine-jobs.service.ts`](/Users/francocappanera/NBC%20Sales/Caller/src/services/lead-engine-jobs.service.ts:191), recipe B unconditionally advances Realtor register rows to parcel lookup and paid `BatchData` skip tracing; [`src/lib/lead-engine-parcel.ts`](/Users/francocappanera/NBC%20Sales/Caller/src/lib/lead-engine-parcel.ts:181) explicitly designates `fl_re` streets as home streets. Add an industry guard before `parcelStep`/`traceStep` that freezes or holds `job.industry_key === 'realtor'` with a reason that only a permitted public business-contact route may resume it. This prevents residential lookup and private-number tracing while leaving identity ingestion available for a later compliant implementation.
