# Pennsylvania PALS licensees

Reviewed 2026-09-24. `pa_licensee` is the PA-only recipe-C route through the implemented `pa_pals` adapter. It accepts active individual Accountancy and Real Estate Commission rows and preserves `PhoneNo1` when present. A licence establishes a credentialed-person candidate. It does not establish that the licensee owns a business, that the phone is a direct business contact, or that the licensee owns the handset.

## Bounded audit

A local five-case fixture/code audit used the first five saved PALS rows through `paPals` on 2026-09-24. Four active in-scope Real Estate Commission person rows were retained with parsed phone candidates; one Auctioneer Examiners row was held as `profession_out_of_scope`. The focused `pa_pals` test passed. This fixture audit used no network, secret, paid provider, trace, contact-data export, or live phone verification. It measures parser behavior only. In particular, it does not measure ownership, mobile classification, reachability, DNC/TCPA status, or delivery.

The parser retains the `total_records_capped_500` note where PALS reports a capped surname result. The surname route is therefore not evidence of complete statewide coverage.

## Workflow and failure cases

The workflow begins with PALS person search, then requires active status, one of the two scoped professions, and a parseable individual. It holds facility, inactive, incomplete-person, and out-of-scope rows. A retained person is a credential candidate. A present `PhoneNo1` proceeds only as a register-phone candidate through mobile, reachability, DNC/TCPA, suppression, duplicate, freshness, and timezone gates.

Before any owner-labelled delivery, an independent source must support an owner or founder role for the matched business and explicitly connect the same phone to that business role. Associate brokers, employees, front-desk contacts, credential-only records, conflicting evidence, and unlinked phone evidence remain held. This is represented by the branched DAG in [pa_licensee.json](../../../src/data/industry-workflows/pa_licensee.json).

## Runtime finding and safe correction

`pullNames` in `src/services/lead-engine-jobs.service.ts` currently writes the individual register name to `owner_name` for recipe-C PALS records. `settleVerified` in the same file can then deliver a mobile, reachable, compliant PALS phone after generic gates, without calling `assessOwnerEvidence`. That makes a licensee appear as an owner in the exported row even though the licence has no owner semantics.

The safe correction is to leave `owner_name` empty for `job.industry_key === 'pa_licensee'` when inserting PALS-derived rows, retain the person as licence-candidate provenance instead, and add a pre-delivery hold in `settleVerified`: only a stored `owner_evidence_status === 'supported'` may pass for this industry. All other PALS rows should update to `held` with `owner_evidence_unresolved`. This requires no new source or provider call. The existing `assessOwnerEvidence` helper supplies the conservative definition: current, independent owner/founder evidence plus an explicitly direct business contact for the same phone.

## Evidence status and remaining experiment

Implemented evidence: the PALS adapter, source scoping, PALS phone parsing, cap note, and generic recipe-C contact/compliance gates. Blocked evidence: owner confirmation and a direct owner-contact link. The historical brain `n=4` rate is not this review's denominator and is not a per-clean-contact result.

After the hold exists, use only a catalog-verified public business-contact endpoint for a lawful 5–20 row aggregate study. Measure separately: active scoped licence, business match, independent owner support, explicit direct-business-contact support, mobile, reachable, DNC/TCPA-clear, suppression/duplicate-clear, and delivered. Do not use residential or property data to identify private phones, paid services, or restricted lists.
