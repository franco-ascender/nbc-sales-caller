# Model routing

`scripts/route-lane-task.mjs` is a local, deterministic planner.  Its pure
`routeTask(policy, input)` export maps a declared task tier and provider to a
model entry in the supplied JSON policy; it does not call a model service.
`effort` records the planning intent only. A provider integration must verify
that its selected model supports an equivalent setting before passing it on.

The CLI reads `docs/lanes/model-routing-policy.json` relative to its own file,
so it can be run from any working directory.  It emits one JSON decision with
the selected tier, provider, model, effort, billing state, rationale, status,
and limitations.

`orchestration` is reserved for the root orchestrator. It uses the policy's
fixed Codex/Astra route, does not require exceptional approval, and ignores
risk and escalation changes. A caller cannot substitute Claude for this role.

Quality gates take precedence over selection: two or more attempts require a
replan, Claude requires explicit availability, and Claude with unknown billing
requires billing confirmation.  High-risk and protected task types route to
the critical tier.  A normal escalation advances exactly one tier and needs a
concrete reason.  The exceptional tier requires both `--exceptional` and a
reason; it is never selected implicitly.

The tool neither changes chats nor executes provider APIs. It does not impose
a hard budget, and it does not measure actual cost or remaining quota; billing
is user-declared.
