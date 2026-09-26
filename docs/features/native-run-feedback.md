# Native Caller and Lead Engine follow-through — 2026-09-26

User feedback supersedes the standalone Test Center design. Keep existing operations, receipts and the USD25 round intact. Remove Test Center navigation and move execution/history into Caller AI Caller and Lead Engine Build a search. The old URL redirects. Do not execute paid work, messages or bookings during engineering verification.

Acceptance:
- Caller shows the real telephone transcript, objections with exact supporting quotes, unanswered questions and appointment delivery status. Booking requires a provider-confirmed event, not a verbal agreement. Duration/cost remain secondary.
- Lead Engine shows discovery, filtering, phone verification, owner evidence and review as distinct stages, including elapsed time and unknown ETA. Rejected rows have reasons; missing/toll-free/duplicate/chain contacts are excluded before paid verification. Export cannot label an unverified business number as an owner mobile.
- Integrate existing BatchData adapter with durable per-number reservations in the same shared USD25 round; fail closed until account-specific pricing is confirmed. Replays and ambiguous outcomes must never pay twice. Verification success is separate from owner identity.
- Correct the dedicated Nalify agent's conflicting missing-offer instructions, make the saved scenario price explicit, slow its opening and tighten natural turn-taking. Do not claim email/booking capability while no authorized calendar connection exists. Preserve identity disclosure and end-call safety.
- Calendar provider/target and BatchData account rate are requested asynchronously. Implement independent improvements while waiting; do not invent configuration or mark blocked capabilities complete.

## Implemented

The standalone navigation is removed; `/test-center` redirects to `/caller#ai-caller`. Caller now renders the saved telephone conversation, quote-linked reasons, unanswered-price and unsupported-callback findings, transcript, review notes and secondary cost details in its existing AI Caller view. Lead Engine opens Build a search and renders the saved markets with filters, exclusion reasons, phone-check results, registry evidence and CSV. Existing two telephone operations and four discovery operations remain intact; no slots or budget were reset.

The dedicated Nalify phone agent was updated in ElevenLabs via configuration PATCH only: explicit scenario price/offer, shorter opening, speed 0.90, patient turn eagerness, concise answers before discovery, no unconfirmed callback/email/booking claims. Voice, model, ten-minute limit and existing tools are preserved. Browser scenario compilation also treats its entered offer and price as confirmed simulation facts. No new voice conversation was generated; perceived improvement remains to be evaluated by the user.

Phone checks reuse the existing BatchData adapter and use a new service-role-only Postgres table. Claim/finish RPCs lock the existing round, count old reservations plus per-phone reservations, respect each market allocation and reject duplicates or uncertain work. Each request checks one previously eligible phone; the user-started UI advances and can pause. A page refresh never starts paid verification. Unknown or stale rates fail closed. Mobile + reachable + DNC-clear + TCPA-clear is a phone result, never proof of owner identity.

Chiropractor research can query the free NPI registry from the saved list. Exact name or published practice phone must match a unique active NPI-2 organization in the same city/state. Keep the official's name/title, registry source and alternate phone as an association requiring review. Ambiguous matches and registry pagination limits remain visible. Do not infer that an authorized official is the owner. Roofing and med-spa owner sources are not connected for these pilot markets.

## Remaining dependencies

- User was asked for the authorized Nalify booking calendar/provider. Local GHL calendar ID and integration token are empty. No booking/email tool is connected, no slot is invented, and no message or appointment is sent. End-to-end booking and invitations remain outstanding.
- User was asked for the account-specific BatchData Phone Verification rate. A key alone does not confirm the former USD0.007 setting. The new verification action remains visibly disabled until the rate and its confirmation timestamp are recorded server-side. The USD25 allowance is not increased.
- Full owner-mobile sourcing across all markets is still incomplete. The new evidence path addresses chiropractor association only, not multi-source ownership proof or private mobile enrichment.

## Checks and evidence

Production build and relevant fixture tests pass. Nine live Postgres assertions passed inside a rolled-back transaction (auth isolation, rate gate, owner gate, phone filter, reservation, duplicate, cross-action pending guard, uncertain guard, total budget). Free NPI GET returned an active organization payload with the expected official and location fields. No paid live tests ran.

ElevenLabs documentation consulted: https://elevenlabs.io/docs/eleven-agents/customization/conversation-flow and https://github.com/elevenlabs/skills/blob/main/agents/references/agent-configuration.md. Registry: https://npiregistry.cms.hhs.gov/api-page. BatchData public marketing materials do not establish this account's effective rate; do not use them as a verified account quote.

Private evidence: `artifacts/readiness/feedback-20260926/`. Includes before/after agent configuration, prior operations, rolled-back storage checks and authenticated read-only UI checks/screenshots; excluded from Git and deployment.

Production UI checks passed in authenticated Chrome at desktop and mobile widths: Caller evidence/transcript present, Lead Engine filters work, verification remains blocked without a rate, free registry action is available, old URL redirects, anonymous API is denied, no browser errors or horizontal overflow. No paid action was dispatched.
