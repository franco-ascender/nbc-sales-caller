# Caller booking — NBC / GoHighLevel

2026-09-30. User requests booking, direct email/SMS invitations, tags and pipeline updates. Initial business: NBC (not Nalify). Local GHL token and calendar are absent. No external messages, appointments or paid calls are authorized as development tests.

## Contract before implementation

- Admin-owned, encrypted GHL connection; explicit calendar, pipeline/stage, sender and notification configuration. Never infer a destination from a scenario. Read-only discovery validates location/calendar/stage. No dependency on another lane's unfinished Tracker credentials.
- Signed Retell tool requests must match a persisted phone operation, agent/version and recipient. Browser practice never performs CRM writes. A call must have an immutable booking binding created before dispatch; enabling later does not grant old calls permission.
- Tools: availability, book, booking status. Offer only real free slots with explicit timezone. Re-check selected slot, require recipient confirmation and verified email; SMS consent separate. Appointment created with slot validation on and native notifications off (direct delivery selected).
- One booking attempt per phone operation. Durable claim before any external writes. Replay returns stored outcome. Ambiguous writes are reconciled, never silently sent again. Tags/stage/email/SMS have separate durable step states. No zero-cost assumption: message cost is unknown until provider billing evidence exists.
- Return appointment receipt only after GHL confirmation. Meeting URL comes from the appointment, never invented. Email contains calendar attachment; SMS contains confirmed meeting details/link. Respect contact/channel DND. Confirmation accepted by provider is not delivery.
- Existing caller remains operational without GHL. Booking setup is inside Advanced tools. Keep recording/cost approval unchanged. Retell tool registration and enabling require validated NBC connection; infrastructure may ship disabled while access is missing.

## Implementation and validation

Updated at delivery below. Tests use fake HTTP responses and isolated database transactions; no real bookings, texts, emails or calls.

## Delivered infrastructure

- `caller-booking.ts` validates configuration, confirmations, timezone offsets, consent and ICS serialization. `caller-booking-tools.ts` defines three Retell custom functions.
- `caller-ghl.service.ts` uses the official v3 endpoints for calendar availability/reservation, contacts, additive tags, scoped opportunity transitions and direct messages. Existing won/lost or ambiguous opportunities are not moved. Native appointment notifications are disabled on our create request; independent GHL contact/tag workflows must still be reviewed when connecting.
- `caller-booking-store.ts` encrypts per-owner credentials with AES-256-GCM and owner-bound AAD. Secret is never returned to the browser. Durable booking and per-action claims prevent duplicate appointments/messages on retry, including timeouts. Unknown writes remain pending reconciliation; no automatic resend.
- `caller-booking.service.ts` binds signed Retell call identity to the immutable pre-dispatch permissions, performs booking and separately processes CRM/notification work after the tool response. Check saved result resumes only unclaimed work and reads message receipts. Ambiguous writes without an identifiable provider receipt require operator reconciliation; they are not safely retryable automatically.
- Caller → Advanced tools → Booking: account/calendar/pipeline selector, tags, direct email/SMS setup, status/history and pause. Make a Call requires explicit booking opt-in, a saved NBC scenario and additional GHL messaging approval. Browser tests never book.
- Invitation email attaches an expiring signed `.ics` URL. Meeting URLs are taken only from GHL. Accepted and delivered messages are distinct. Costs remain NULL/pending: GHL send responses do not provide billable amounts. Messaging is outside the voice-only $2.50 reservation; it is not represented as free or a final all-in cost.
- `prepare-caller-booking.mjs <owner UUID>` prepares an isolated Retell agent only after a saved GHL connection exists; it preserves the existing caller and does not start calls or enable booking. Interrupted agent creation requires reconciliation before retry. Its inherited quote expiration is not automatically extended.

## Activation still requires NBC access

Token, NBC calendar, pipeline/stage and authorized GHL email/SMS sender remain required. Save connection in Booking, register the isolated phone tools with the preparation script, then enable and opt into a call. Sender delivery/scopes, meeting link generation and real booking behavior need a controlled live test after those inputs are provided. No live test was executed during implementation.

## Verified

499 automated tests, production build, database rollback invariants (atomic slot + permission snapshot, replay conflict, unique booking and action claims, RLS and grants); desktop/mobile browser results recorded in artifacts/readiness/caller-booking. External provider lifecycle is tested with HTTP fixtures, not represented as live GHL evidence.

## Official references checked 2026-09-30

- https://marketplace.gohighlevel.com/docs/ghl/calendars/get-slots/
- https://marketplace.gohighlevel.com/docs/ghl/calendars/create-appointment/
- https://marketplace.gohighlevel.com/docs/ghl/calendars/get-appointment/
- https://marketplace.gohighlevel.com/docs/ghl/contacts/upsert-contact/
- https://marketplace.gohighlevel.com/docs/ghl/contacts/add-tags/
- https://marketplace.gohighlevel.com/docs/ghl/opportunities/search-opportunity/
- https://marketplace.gohighlevel.com/docs/ghl/conversations/send-a-new-message/
- https://docs.retellai.com/build/single-multi-prompt/custom-function

Deployment check: `.vercelignore` now anchors `/config` at repository root, keeping the server configuration directory excluded without omitting the new `/api/caller/booking/config` route. Uploaded source digests are checked before alias promotion.
