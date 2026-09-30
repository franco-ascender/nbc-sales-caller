# NBC client operations — foundation and integration boundary

Status: architecture foundation, September 29, 2026. Anas's detailed workflows are still pending. This document does not claim a Slack replacement, task manager or automatic client onboarding is implemented. Keep the current focused navigation until those workflows are specified.

## Confirmed direction

NBC program members need a shared place for client communication, NBC/client tasks and accurate business tracking. Clients should authorize their accounts once, then see synchronized data rather than reconstructing activity from memory during weekly check-ins. NBC also needs an internal operational view. English UI; same NBC identity.

## Existing components to reuse

- `nbc_members`: admin, coach and student roles, active/suspended status, coach assignment.
- `nbc_onboarding`: business, timezone, goal and questions.
- `nbc_messages` and `member-workspace.ts`: persistent, authorized student/coach messaging. This is not Slack-style channels, threads, mentions, attachments or notifications.
- `nbc_tickets`: basic support requests; not a project/task manager.
- `tracker-types.ts`: normalized snapshots and explicit missing data. GHL has a single configured account adapter; Meta and Stripe tracker adapters are placeholders, not functioning client connections.
- Caller/Lead Engine: existing contacts, verified lists, calls, usage and archive. Preserve their identifiers and provenance rather than importing duplicate metrics.

## Required shared boundary before adding features

Introduce a **client workspace** as an explicit business/account scope, distinct from a login. A person can belong to several workspaces. NBC internal operations use a separate workspace. Every task, conversation, integration and metric belongs to one workspace.

Proposed records (not yet migrated):

| Record | Minimum contract |
| --- | --- |
| Client workspace | ID, name, client/internal kind, status, timezone |
| Workspace membership | Workspace, user, explicit permissions, active status; uniqueness on workspace/user |
| Conversation | Workspace, participants or channel membership, client-visible/internal visibility |
| Message | Conversation, author, body, parent message, creation/edit timestamps, idempotency key |
| Task | Workspace, title, status, accountable assignee, due date, creator, client-visible/internal visibility, revision |
| Task activity | Task, actor, event, timestamp; preserves assignment/status history |
| Integration connection | Workspace, provider, authorized external account, granted scopes, secret reference, connection state, last successful sync |
| Sync job | Connection, cursor, attempt, retry time, state, bounded work and cost; unique delivery/operation key |
| Metric observation | Workspace, metric definition/version, period, value/unit, source account, source event ID, observed time and sync time |
| Weekly check-in | Workspace, period, question version, answers, author, timestamp; linked to observations without silently replacing them |

Permissions must be enforced in storage and server routes. NBC role alone must not grant a client access to another client's data. Internal messages/tasks must never be returned in client payloads. Existing owner-specific data must be explicitly mapped during migration, never globally exposed to all admins or reassigned just to let a second tester in.

## Tracking rules

Agree first what counts as a lead, booked appointment, attended call, won deal and collected revenue. Those are different events. Preserve source IDs and deduplicate retries. Cancellations/refunds/corrections must update the appropriate observation without double counting.

Every number needs a period, timezone, provenance and freshness. Show missing, disconnected, syncing, partial, stale and error states separately from zero. A manually reported check-in answer is visibly manual; it is not provider-verified data. A scheduled meeting does not prove attendance, and an open opportunity does not prove revenue.

## Connection lifecycle

An authorized workspace member connects a provider account. Bind the authorization request and callback to that workspace/member, verify external account ownership/scope, store secrets server-side, and start a bounded initial sync. Subsequent signed events and incremental jobs resume from persisted cursors. Disconnect/revocation stops syncing and is visible to the member. Each provider requires its own implementation and live verification; adding credentials is not completion.

Do not reuse the current global GHL environment credential across clients. Select the first provider only after Anas identifies what clients actually use. Do not enable paid backfills, send client messages, import Slack content or request broader account permissions without the corresponding scope/cost authorization.

## Implementation order

1. Client workspace membership, permission tests and an explicit mapping of existing NBC accounts/data.
2. One task workflow and client/coach communication flow with activity history and visibility tests.
3. One real connector end to end: connect, initial sync, incremental updates, revoke/reconnect, retries and account isolation.
4. Weekly dashboard and check-in reconciliation using agreed definitions and freshness indicators.
5. Additional providers, Slack history migration and NBC internal operations once their workflows are known.

Inputs still needed from Anas: examples of real Slack channels/threads and task assignments; roles/visibility; exact weekly questions; systems used by clients; metric definitions; priorities for NBC internal operations. No new navigation tabs are required merely to collect this context.

## Current collaboration issue

The Caller test round is currently scoped to a single `owner_id`. Changing that field to enable a different teammate removes the previous user's access even though application roles remain admin. On investigation, the live round was assigned to another collaborator while historical recording assets remained owned by Franco. Resolve the intended sharing policy before changing ownership or adding permissions; do not erase or take over the collaborator's newer operations. This demonstrates why team access should be explicit membership rather than owner reassignment.
