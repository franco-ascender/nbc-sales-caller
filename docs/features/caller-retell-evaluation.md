# Retell evaluation and operation cost accounting — 2026-09-26

## Decision and scope

Evaluate Retell with Anas's ElevenLabs voice, retaining Twilio and NBC's caller workflows. Do not route production calls to Retell or launch paid benchmarks yet. No RETELL_API_KEY is currently configured. Do not publish Anas's private clone to a community library to work around access. Retell's public import API accepts community voices; exact portability of this private clone must be checked in the account. A newly trained clone is not automatically the same voice.

The current telephone agent uses GPT-4.1 mini, a 4,435-character prompt, 140 output tokens, Eleven Flash v2 at speed .9, streaming optimization 3, and patient turn eagerness. Read-only inspection of the latest 107-second call found a 5.754-second response with 5.184 seconds of turn silence and .138 seconds TTS first-byte time. This identifies one turn-detection delay, not proof that every slow response has that cause. Seven responding turns excluding the greeting; small sample. No configuration changed by this inspection.

Compare: current ElevenAgents with tuned turn-taking; Retell + the same ElevenLabs voice; Vapi as a flexible alternative with configurable pipeline/endpointing. Retell is the preferred evaluation candidate, not a proven fastest provider. Do not chain ElevenAgents into Retell: Retell would orchestrate STT, response model and ElevenLabs synthesis directly. Keep tools, approved scenario, consent, idempotency and cost approval in NBC.

Acceptance: same scenario/voice/phone/script, repeated user-run calls with quoted ceilings; capture turn E2E p50/p90/p95/p99, TTS and LLM latency, interruption recovery, false cut-ins, booking/tool correctness, and cost per connected minute. Exclude initial greetings from response latency. Provider latency omits some telephony/network delay; label definitions. Suggested target (not a promise): median below .8s, p95 below 1.5s, no quality regression. Test 20+ turns per variant before choosing, then expand beyond one conversation.

## Costs

Retell public pricing inspected: infra $.055/min + ElevenLabs $.040/min + GPT-4.1 mini $.0128/min = $.1078/min before telephony/add-ons/taxes. Retell telephony listed $.015/min gives illustrative $.1228/min or $1.228/10min. Custom SIP has no Retell telephony charge, but Twilio still invoices its own usage. Verify account quote before use; do not reuse current $2.50 approval blindly. Retell hosts TTS: don't add a second hypothetical ElevenLabs TTS invoice on top of its bundled receipt. Subscription fees, top-ups and usage consumption are different accounting dimensions.

## Implementation for this release

Add an admin-only read-only operation report to existing Usage, not another dashboard tab. Derive rows from saved operations and checks, aggregate providers, and show maximum approved / reserved / reported / rate-based estimated / missing separately. No synthetic zero for missing receipts. Verification rates must be snapshotted at claim time, not reconstructed from today's configuration. Old checks with no snapshot remain unknown. Deduplicated checks are charged only to their original list, while qualification can be reused in another list. Rate snapshots are estimates until matched with a provider receipt.

Persist latency summaries and ElevenLabs platform/LLM components on phone result reconciliation. Implement and test a Retell receipt normalizer (cents to micro-USD, total not plus components; no receipt is unknown) for a later authenticated adapter. This release does not activate Retell. Existing member usage and provider-wide totals are separate views, never added to operation totals. Costs refresh from saved receipts; this is not a global invoice reconciler or a background polling service.

Validate unit conversion, duplicate checks, missing rates, failed/uncertain checks, response metrics, role isolation, migration rollback, build and read-only UI. No paid operations.

Sources:
- https://docs.retellai.com/build/voice
- https://docs.retellai.com/api-references/add-voice
- https://docs.retellai.com/build/tts-provider-comparison
- https://docs.retellai.com/deploy/custom-telephony
- https://docs.retellai.com/reliability/troubleshoot-latency
- https://docs.retellai.com/reliability/check-actual-latency
- https://docs.retellai.com/api-references/get-call
- https://raw.githubusercontent.com/RetellAI/retell-typescript-sdk/main/src/resources/call.ts
- https://www.retellai.com/pricing
- https://docs.vapi.ai/customization/voice-pipeline-configuration
- https://elevenlabs.io/docs/eleven-agents/customization/conversation-flow

Read-only voice check: active voice `Anas Daoud — NBC Caller` is a professional clone, not shared, and lists Flash v2/v2.5 among its supported models. No voice sharing permissions or agent configuration were changed.

Implemented files: `caller-measurements.ts` (ElevenLabs turn summary and Retell cost/latency normalization), `operation-costs.ts`, admin costs service/GET route, and existing Usage panel integration. Migration `202609261000_verification_rate_snapshot.sql` snapshots the exact configured verification unit price on newly claimed numbers; existing history is intentionally not relabeled with today's rate. No Retell calls or live provider switch is implemented yet. Provider-wide browser usage remains in the pre-existing Usage section; this new breakdown covers stored telephone trials and lead-list operations.

Release: `dpl_3xB7DitQrFaNMKAySoVMz52GZGCm`, production. Reconciled four already-ended telephone calls read-only with providers and persisted their latency summaries. No calls or paid searches initiated. Admin report returns nine stored operations; all 66 historical verification checks lack contemporaneous stored rate snapshots and are explicitly missing, not silently priced at today's rate. The earlier forensic cost report remains the source for those historical reconciled costs. Automated invoice reconciliation and retrospective evidence import remain follow-up work.

Final release including mobile table containment: `dpl_D8PiFuDKFtQAs1VqarT8Lc2yzqQ7`. Production read-only browser check passed at 1440px and 390px with no page overflow, anonymous costs API 401, and zero paid mutations. Five new unit tests passed (conversion, latency, attribution and access), existing seven route tests passed, transactional storage assertions rolled back successfully, typecheck and production build passed. Retell credentials and private-clone portability remain the only account prerequisites for inspecting that integration; no claim of improved live latency has been made without a controlled user-run comparison.

## Account connected — 2026-09-26 23:42 UTC

RETELL_API_KEY verified by authenticated read-only requests. The account lists 300 voices, none named Anas/NBC. One existing Conversation Flow Agent appears in versions 0 and 1, using retell-Cimo. One Retell-managed Twilio number ends in 6623, with neither inbound nor outbound agent assigned. No agents, number routing, voices or production configuration changed. No paid operations.

Added a server-only Retell receipt reader: fixed GET endpoint, timeout, no redirects, saved call/agent identity checks, existing cents-to-microUSD and latency normalizer. Not wired to outbound dispatch until the correct voice and an approved quote are ready. Tests cover no-request invalid IDs, mismatched provider identity and unknown receipts.

Retell support explicitly says ElevenLabs BYOK is unsupported: https://community.retellai.com/t/enable-elevenlabs-byok-private-voice-clone-not-selectable/886 . ElevenLabs supports external sharing of professional clones through an anyone-with-link share link, separate from public Voice Library listing: https://help.elevenlabs.io/hc/en-us/articles/18644643807889-How-do-I-share-a-voice . Requested ELEVENLABS_VOICE_SHARE_URL to test that import path; compatibility is not claimed until accepted by Retell. Do not turn on public listing or silently create a different clone. Remaining work: verify import; create isolated Nalify scenario agent; price/config snapshot; extend per-operation dispatch/reconciliation for Retell; signed webhooks and durable provider receipt storage; user-approved comparison. Existing Retell-managed number can be evaluated without buying another number, but do not repoint current Twilio routing by inference.

## Shared clone imported and evaluation agent staged — 2026-09-27

Authenticated ElevenLabs read confirms sharing enabled and `enabled_in_library=false`. The provided link omitted the public-owner segment. Recovered authoritative `sharing.public_owner_id` and `original_voice_id` from the voice response (not `/v1/user` or an inferred ID). Retell `POST /add-community-voice` accepted the existing professional clone (201). No new clone, audio generation, public-library listing or permissions change was performed.

Created isolated agent `NBC · Nalify Garage Doors · Retell evaluation`, preserving the existing example and live ElevenLabs agent. Uses the imported ElevenLabs clone, Flash v2, speed .9, GPT-4.1 mini standard priority, responsiveness 1, interruption sensitivity .8, no backchannels, 10-minute evaluation cap and 60-second idle termination. Copies the current Nalify scenario and first message with concise-response and truthful unconnected-tool instructions. Only end_call is connected. Signed recording URLs requested. These are evaluation settings, not measured latency improvements.

Read-back verified voice, duration and LLM identity. Private resource IDs and receipts: `artifacts/readiness/retell/voice-import.json` and `candidate.json`. Number routing remains unchanged. Zero calls initiated. The portal still uses ElevenLabs; Retell dialer selection, per-operation cost reservation/dispatch reconciliation and webhook persistence are not yet implemented. This staging task does not claim a production migration or a callable Retell portal flow.

## Retell Dialer activation contract
User explicitly requests immediate portal integration and a user-run test. New phone slots snapshot Retell agent/version/voice/from/config hashes and dated quote; historical slots retain ElevenLabs. Keep atomic DB reservation, recipient confirmation, $2.50 ceiling, 10-minute duration, US basic lookup, one unresolved operation, no automatic dispatch retries. Use existing Retell-managed number ending 6623 and per-call version override, not a number routing change. Stop/readback target persisted call ID and validate agent/version/from/to. Retell bundled receipt is counted once, not again as Twilio and ElevenLabs. UI persists transcript, cost components, latency, and refresh/reload. Normal polling reconciles while the portal is open; manual Update saved result reconciles after closing it. No production paid test by the coding agent. Validate fixtures, SQL rollback, provider read-only preflight and deployed UI before activating new slots.

## Production activation verified — 2026-09-27

Deployed `dpl_dA6SU7FYPYPqz8ufR1YuQKNEh2ZN` and activated Retell for new telephone trials on the normal production portal. Existing browser voice tests remain ElevenLabs. Published candidate version 0; production secret configured. Authenticated production `GET /api/caller/phone-test?check=1` returned 200 after verifying the pinned published agent/LLM configuration and existing number; `phoneEngine=retell`, `paused=false`, `pending=false`. Read-only browser verification confirms recipient confirmation gates Start and enables it afterward; anonymous API access returns 401. Zero paid mutations or calls initiated. Relevant provider/route/cost tests, transactional snapshot checks and build passed. Evidence: `artifacts/readiness/retell/production-preflight.json`, `artifacts/readiness/extra-phone-trial/ui.json`.

User can initiate the first real comparison from Caller → Dialer. Lower response delay remains an expectation, not an observed result. Provider receipts reconcile through active portal polling/manual refresh; background webhook reconciliation is still outstanding.
