# Per-operation cost approvals

Franco requested replacing the cumulative USD25 pilot ceiling with a yes/no cost approval per action. Keep historical reservations intact; use a per-operation approval mode on the existing private round. New calls require approval of USD2.50 for the bounded ten-minute test. New lists require approval of discovery plus a conservative verification reserve. Posted amounts must match server-calculated amounts; store approval timestamps and ceilings with the slot. Old saved-list paid actions require their own approval. Retain concurrency, idempotency, unknown-charge holds, the testing volume gate, provider checks and per-list allocation. Remove the daily trial quota in this mode as well; spending always needs explicit approval per call. Do not start paid work during release tests.

UI shows an estimate/maximum authorization rather than falsely promising an exact final charge. The final provider receipt may be lower. No historical budget reset, fabricated extra wallet funds, or automatic purchases/top-ups.

## Release 2026-09-26

Applied `202609260900_per_operation_approval.sql` and activated `settings.perOperationApproval` on the operator round. Deployed `dpl_De49MvkeU7SQwGAnccJQcv3w4ta9` to the normal production alias. Restored the telephone agent's provider default daily limit (100,000); removed the application's three-trial/day gate in this mode. The 10-minute duration, single-call concurrency, authentication and disabled burst pricing remain unchanged. The provider daily limit is not a budget authorization.

Validation: rollback-only database assertions above the historical $25 threshold; input and route tests; production build; deployed UI fixtures for call/list approval and cancellation, duplicate clicks, lost responses, reload, progress and exports. Fixtures made no paid provider requests. Evidence: `artifacts/readiness/per-operation-approval/`, dialer and lead-cycle UI fixture reports. Search execution still supports up to 50 businesses per list; this change does not unlock 5,000-record searches or purchase numbers.
