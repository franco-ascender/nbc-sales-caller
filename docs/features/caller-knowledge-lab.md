# Caller — Knowledge Library and Conversation Lab

Date: 2026-09-19. Scope: Caller admins. This contract covers old-call ingestion and scenario-based browser simulations. It does not start phone campaigns or retrain the cloned voice.

## Product flow

The Knowledge Library accepts two source paths:

1. **Transcript / playbook text.** An admin pastes reviewed text. It enters `review` and remains unavailable to the agent until an admin approves and syncs it.
2. **Call audio.** An admin reserves an immutable private object path and uploads directly to Supabase Storage using a short-lived signed upload token. It enters `uploaded`; transcription and speaker review remain explicit later actions. Uploading audio never updates the agent and never trains a voice.

Every source keeps title, kind, uploader, consent/authorization assertion, speaker/context notes, content hash where available, status, provider document ID, approver and timestamps. Raw audio is private. Browser roles have no direct bucket policy; only the service creates a one-time upload token. A replacement receives a new source ID/path, so malformed audio cannot overwrite a valid source (C-AUDIO).

Statuses: `uploading → uploaded → transcribing → review → approved → syncing → synced`, with `failed` and `archived`. Only a reviewed transcript/playbook can be approved. A provider timeout after document creation becomes `sync_unknown`; it is reconciled before another provider creation is allowed. Provider document IDs are unique.

The first implementation prepares storage, text sources, immutable audio upload, source review and UI. Transcription is not automatic and no provider consumption is triggered by upload. An admin can explicitly choose **Approve & sync** for a reviewed transcript/playbook. That action creates one ElevenLabs text document, records its provider ID before attachment, attaches it to the browser agent and enables RAG with `auto` usage. Ambiguous document creation becomes `sync_unknown` and cannot issue a second create; known document IDs are reconciled against the agent first. ElevenLabs accepts text and document sources and supports RAG retrieval for larger knowledge bases. Official contracts: [knowledge base](https://elevenlabs.io/docs/eleven-agents/customization/knowledge-base), [text document API](https://elevenlabs.io/docs/api-reference/knowledge-base/create-from-text), [RAG](https://elevenlabs.io/docs/eleven-agents/customization/knowledge-base/rag).

## Conversation Lab

Admins build a structured brief with:

- simulation title and conversation type;
- agent role and objective;
- prospect profile and situation;
- offer, ticket/range and desired outcome;
- objections or constraints to surface;
- tone and any additional instructions.

The server validates and compiles this into a bounded per-session override. It never stores arbitrary provider configuration, model IDs, tools or secrets supplied by the browser. The scenario applies to one browser test and is recorded with the session for later evaluation. Default voice tests keep the standard agent behavior. The Lab does not allow real-world actions, commitments, payments or phone dispatch.

## Access and retention

Only active admins may create, list, review or sync knowledge and scenarios. Students/coaches can use future approved experiences but cannot see source transcripts, audio paths, provider document IDs or internal scenario instructions. Imported calls must be authorized for NBC's internal training/reference use. The assertion is audited; the product does not infer consent from file possession.

Raw audio defaults to deletion after an accepted transcript and review unless an admin explicitly marks it for retention. Transcript removal and provider-document detachment need a separate destructive workflow; neither is implicit in archive.

## Acceptance

- A malformed or oversized file cannot replace a saved source.
- A duplicate request returns the original source; a mismatched reuse returns conflict.
- Audio upload alone cannot alter the agent or create provider consumption.
- Non-admin requests fail before storage or provider work.
- Scenario text is bounded and compiled server-side; one scenario cannot persist into the next session.
- Provider prompt/first-message overrides are enabled only on the separate browser-test agent; the phone agent is unchanged.
- Browser tests use one verified ten-minute contract in the app and provider (`600` seconds). Session start repairs drift before issuing an authorization.
- Finalized provider results persist `cost_fiat` as integer micro-USD alongside duration. The admin Usage page reads the provider workspace analytics feed for today, 7-day and 30-day totals, product breakdown, plan allowance and current overage. Provider totals remain distinct from NBC Credits and from the eventual card invoice.
- Refresh preserves saved sources/scenarios and session history.
- Source/provider ambiguity is visible and never retried as a second create.
