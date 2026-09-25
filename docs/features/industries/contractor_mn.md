# Minnesota contractor workflow review

Reviewed 2026-09-24. This review concerns the live `contractor_mn` recipe-D entry only. Its historical expected rates remain research estimates in the live brain and are not a measurement in this dossier.

## Hypothesis

The MN DLI Electrical and Plumbing CSVs can supply an active Master-level license identity and a published business-phone candidate. A `Personal` row names a licensee candidate; it does not establish business ownership, handset ownership, mobile line type, reachability, DNC eligibility, or permission to contact that person. A `Business` row is business-only. The documented shared-phone risk must be held before any owner or direct-contact classification.

## Source scope and limitation

The catalog marks the DLI CCLD CSV endpoint as VERIFIED and describes licensee name, business, class, status, and mixed phones. It specifically records phone reuse as high as 189 licenses and directs a frequency filter. The current adapter requests only `Electrical` and `Plumbing`; its saved local fixture records that a requested Residential Building Contractor category returned an HTML error page despite HTTP 200. No live request was made in this review, so that limitation is a saved-fixture/runtime finding, not a current availability measurement.

The source gives no owner-confirming field and no independent handset evidence. Do not use property, residential, private-phone, paid lookup, or append paths to fill that gap.

## Five-case local fixture/code audit

On 2026-09-24 I called `mnDliRecord` with five synthetic CSV-shaped rows. No network, secret, personal contact, address, or phone value was retained. This is a code audit, not a source-coverage or outcome measurement.

| Case | Expected route | Observed route |
| --- | --- | --- |
| `Personal`, `Class A Master Electrician`, `Issued`, expires today | Active through its listed expiration date | Rejected as `expired` |
| Same row, expires tomorrow | Eligible identity candidate | Kept with person candidate |
| `Business`, Master, `Issued`, expires tomorrow | Business-only candidate | Kept without person name |
| Personal Master, status not `Issued` | Reject | Rejected as `status_not_issued` |
| `Class A Electrical Contractor`, not Master | Reject under the documented Master-only cohort | Rejected as `not_master_level` |

The failure is concrete: `mnDliRecord` calls `inFuture(expires, today())`; `inFuture` implements a strict `>` comparison. Thus an `Issued` MN Master row whose stated date equals the session date is dropped before any role or contact gate. The safe correction is local to the MN adapter: use an explicit `expires !== null && expires >= today()` validity predicate, with a regression fixture for the expiry-day case. Do not broaden `inFuture` globally without reviewing each register's documented expiration semantics.

## Decision workflow

1. Choose MN DLI Electrical or Plumbing only when the source remains available and terms remain eligible; hold HTTP-success HTML/error content and unavailable categories.
2. Keep only `Issued`, Master-level licenses current through their stated expiration date. A non-Master electrical-contractor row remains out of this documented Master cohort.
3. Mark a `Personal` licensee as a role candidate and a `Business` row as business-only. Neither is owner confirmation.
4. Use the published register phone only as a business-contact candidate. Hold absent, shared, or reused numbers; the current selection code counts reuse within a source, while the catalog's distinct-business/person threshold needs explicit source-aware enforcement.
5. Require independent owner evidence plus line type, live, DNC, suppression, and delivery-dedupe gates before an owner-confirmed classification or delivery.

## Industry-specific failures and correction

| Failure | Mitigation | Status |
| --- | --- | --- |
| An expiry-day Master license is treated as expired. | In `mnDliRecord`, accept a parsed `Exp_Date` equal to today; retain all other status and Master filters. | Proposed shared-runtime correction |
| A Personal licensee is called an owner. | Persist it only as a license-role candidate and require independent owner evidence. | Partial |
| A Business license row or register phone is called a direct owner mobile. | Keep business-only/contact-candidate provenance and enforce contact gates. | Partial |
| A phone shared by many DLI records bypasses a narrow reuse calculation. | Count distinct business names and persons across the eligible MN cohort; hold over two businesses or over three persons as catalogued. | Blocked pending explicit implementation |
| An HTTP-200 HTML error page or unsupported DLI category is ingested as a CSV. | Preserve header/content assertion and hold unavailable category routes. | Implemented |

## Remaining measurement

Run the proposed expiry-day regression locally, then, if the verified endpoint remains legally eligible, perform a bounded aggregate-only public-source sample that reports status, Master-level, Personal/Business, and reused-phone counts without retaining contacts. A separately authorized outcome study would need to measure line type, DNC result, reachability, independent owner confirmation, and delivery before any clean rate or per-clean cost can be claimed.

## Runtime finding for root review

`src/lib/lead-engine-registers.ts` function `mnDliRecord` applies `inFuture(expires, today())`. The shared `inFuture` predicate is strict (`iso > today`), so it rejects an otherwise eligible MN DLI Master license on its expiration date. A contained correction is to replace that call with `expires !== null && expires >= today()` in `mnDliRecord`, and add the five-case audit's expiry-day regression in `tests/lead-engine-registers.test.ts`. This review did not modify shared runtime or tests.
