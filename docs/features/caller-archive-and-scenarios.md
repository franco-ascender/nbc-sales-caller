# Caller scenarios, Archive and Analytics

Implemented on `feature/portal-updates-2026-09-29`. Review URL:
https://nbc-sales-caller-review-20260929.vercel.app/caller

## Product flow

- **Make a Call** selects a saved Conversation Lab scenario directly. Default remains Nalify / Garage Door Business Owner. Recipient confirmation and the $2.50 / 10-minute authorization remain mandatory. Changing scenario clears confirmation. No automatic dialing on selection, transfer, refresh or retry.
- Each new phone slot snapshots the selected, owned scenario and the published Retell configuration. Reusing an attempt with a different recipient or scenario is rejected. The isolated Retell agent receives the compiled scenario as a per-call variable; it retains Anas's ElevenLabs voice. It does not change the existing production agent.
- **Conversation Lab** contains knowledge/scenario preparation and the internal browser voice test. Queue activation and the duplicate calling-list UI have been removed. Historical sessions and results moved to Archive; aggregate charts live in Analytics.
- **Archive** lists phone calls alongside the paginated browser history. It offers private audio playback, transcript export and versioned private notes. Existing conversations are not relabeled as newly recorded.
- **Analytics** combines loaded browser sessions with saved phone operations. Existing time/source filters, minutes and CRM charts remain. Counts describe loaded records, not the entire provider account.
- Completed Lead Engine results can transfer phone-qualified contacts into the existing CRM, with idempotent import and duplicate handling. Contacts can prepare one call with the number filled in; this does not approve or initiate a call. Bulk selections remain available for saved lists, not unapproved mass calling.

## Recording and live updates

New phone calls explicitly request full recording and announce recording/transcription in the opening. Browser authorization verifies audio recording and the corresponding disclosure before issuing a voice session.

Retell sends signed `transcript_updated` events. The server verifies raw-body HMAC, freshness, call ID, version, agent, origin number and destination against the persisted operation. Live text is a per-turn update with polling/delivery delay, not word-level streaming. Active calls show a timer and animated status. The timer measures elapsed time since the request, including dialing.

After-call events reconcile provider-reported results/costs and save recordings to the private `caller-recordings` bucket. Portal reads resume interrupted saves with database claims, two recordings at a time and a 15-minute retry interval. Manual playback also retries acquisition. Existing browser audio is recovered when retained by the provider; recordings never captured cannot be reconstructed. Notes and recordings are owner-scoped; playback links expire after 15 minutes. A current external webhook delivery still requires a user-initiated call to verify end to end.

Recording retrieval permits only the observed Retell S3/CDN hosts and recording filenames, rejects redirects, bounds audio size to 50 MB, checks the audio format, and validates provider identity before fetching audio. An interrupted upload may be retried without dialing or overwriting notes. Retell webhook signing uses `RETELL_WEBHOOK_SECRET` if supplied, otherwise `RETELL_API_KEY`; the key must be the workspace's webhook signing key.

## Deployment and migration

Additive migrations:
- `202609290100_caller_archive.sql`: private assets, bucket, scenario snapshots, ordered webhook updates.
- `202609290110_caller_archive_retries.sql`: recording retry claims.

The review deployment uses production services but a separate URL. It does not replace the main production alias or merge the branch. `CALLER_WEBHOOK_ORIGIN` must point at the publicly reachable review alias, not Vercel's SSO-protected generated deployment URL. Application authentication and webhook signature checks remain enforced. In this environment, the CLI still moved the main aliases despite `--skip-domain`; both were explicitly restored and verified against the prior deployment (`dpl_3WxVJe8mTXMdsWCAmbd9dYS56hiQ`). Future branch deployments must verify alias targets rather than relying on that flag. When merging/promoting, set this origin to the intended stable application domain.

No new phone numbers, real calls, scraping or verification jobs were started for this change. Provider configuration was created without generating conversations. Existing retained recordings were copied to private storage.

## Verification

- Full unit/route suite, including dispatch idempotency, ownership, approval, disclosure, webhook signatures and recording URL validation.
- `node tests/caller-archive-sql.mjs`: live database assertions inside a transaction that is always rolled back; checks private bucket/client permissions, scenario ownership/snapshot, request conflicts, approval and out-of-order events preserving notes.
- `node tests/caller-archive-browser.mjs`: intercepted HTTP fixtures on desktop/mobile; tests scenario selection, cancel/approve, one dispatch, live transcript, stop, Archive audio/notes, Lab separation and Analytics. All calling requests are fixtures.
- Published scenario configuration checked read-only against Retell. Existing audio copied and signed playback verified with a range request. No paid test call was made.
