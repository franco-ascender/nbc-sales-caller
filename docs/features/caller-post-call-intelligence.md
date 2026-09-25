# Caller post-call intelligence

Status: live configuration and application integration, 2026-09-21.

## What runs after a call

Both the browser test agent and telephone agent keep ElevenLabs Topic Discovery and Sentiment Analysis enabled. NBC analysis v1 adds seven bounded data fields:

- call intent;
- primary objection and a short grounded detail;
- buyer stage;
- agreed next step;
- whether a human must follow up;
- customer-care issue category.

It also adds four quality evaluations: discovery quality, objection handling, next-step quality, and trust/customer care. The provider analyzes the transcript after the conversation. The application normalizes only these approved fields and stores them in `call_sessions.post_call_analysis`; raw provider analysis payloads and provider rationale for data fields are not stored.

The Insights screen groups structured results across conversations. A theme becomes **REPEATING** after it appears in two distinct verified conversations. Older calls without structured analysis still use conservative phrase matching against user turns, and the UI marks whether evidence came from structured analysis or a phrase match.

Opening a completed enriched conversation now shows its provider classifications, sentiment, and quality evaluations. An operator can correct the objection, customer-care category, and agreed next step and add a bounded review note. Corrections live in `call_sessions.analysis_review`; the original provider output stays intact in `post_call_analysis`, and recurring-theme reports prefer the reviewed classification.

`POST /api/caller/webhooks/elevenlabs` is the production receiver for automatic post-call results. It verifies the raw-body HMAC, accepts only the two owned NBC agents, normalizes the same approved analysis schema, deduplicates deliveries, and atomically attaches the result to the reserved call session. Retries can match a previously early delivery after the session exists. The endpoint and database path are deployed, but the ElevenLabs workspace webhook remains unattached until the API key has `webhooks_write`; `node scripts/configure-caller-webhook.mjs --prepare` then provisions the HMAC secret in both local and Vercel environments, and `--attach` enables delivery.

## Operating rules

The system discovers patterns but does not rewrite the live caller prompt automatically. A false extraction should never train the next call without review. Operators open the supporting transcript, decide whether the pattern is real, and then change a playbook or run a controlled prompt experiment.

`config/nbc-caller-analysis-v1.json` is the source of truth for post-call fields and evaluations. `scripts/configure-caller-analysis.mjs` applies and verifies it on both agents. `config/nbc-caller-brain-v2.json` is the live conversation brain; version 2.2 includes customer-care routing and explicit resistance to prompt extraction, provider/model disclosure, and exposure of proprietary NBC operating details while preserving truthful AI disclosure.

`config/nbc-caller-eval-v1.json` defines the first regression suite: 14 simulations for timing rejection, ambiguous discovery, price pressure, prior bad experience, an existing solution, shared decision-making, do-not-call, billing escalation, human handoff, prompt extraction, no fit, qualified next step, long answers, and unsupported proof requests. `scripts/configure-caller-evals.mjs --sync` created them in ElevenLabs and `--verify` confirms the remote library without running inference. Simulation runs remain deliberate because they consume provider resources; model, voice, latency, and turn-setting changes should be compared against this fixed suite before promotion.

## Why these fields

- ElevenLabs recommends structured data collection for lead qualification, customer intelligence, support analytics, and downstream post-call integrations. It warns that every rule adds analysis time, so v1 stays at seven fields rather than collecting everything imaginable: [Data collection](https://elevenlabs.io/docs/eleven-agents/customization/agent-analysis/data-collection).
- Success evaluation is designed for sales performance, support quality, compliance, and coaching. The four NBC criteria are measurable and return success, failure, unknown, or a bounded discovery score: [Success evaluation](https://elevenlabs.io/docs/eleven-agents/customization/agent-analysis/success-evaluation).
- Analytics should compare outcomes, duration, cost, errors, evaluation criteria, and collected dimensions. Topic Discovery is the provider-level cross-conversation layer; NBC Insights is the application-level view with transcript evidence: [Analytics](https://elevenlabs.io/docs/eleven-agents/dashboard), [Spotlight](https://elevenlabs.io/docs/eleven-agents/dashboard/spotlight).
- Salesforce's objection workflow is to acknowledge emotion, clarify the real objection with open questions, then respond. This maps directly to the live caller brain and the objection-handling evaluation: [Discover objections](https://trailhead.salesforce.com/content/learn/modules/objection-handling-strategies/learn-how-to-discover-objections).
- Twilio's conversation analysis guidance separates intent, scoring, entity extraction, tailored summaries, script adherence, and qualification. NBC follows the same separation instead of treating a transcript summary as a report: [Generative Custom Operators](https://www.twilio.com/docs/conversation-intelligence-classic/generative-custom-operators).

## Reporting model

Reports answer four different questions:

1. **Operations:** volume, duration, cost, error rate, and response latency.
2. **Sales:** buyer stage, objection mix, discovery quality, next-step rate, and human follow-up.
3. **Customer care:** issue category, frustration/sentiment, truthful resolution or escalation, and stop requests.
4. **Learning:** recurring themes with the conversations behind them, followed by reviewed changes and one-variable experiments.

No category is treated as a confirmed lost-deal reason merely because it appeared in a transcript. Each conversation counts once per theme, percentages may overlap, and small samples remain visibly small.

## Current boundary

No historical Anas call library is attached yet, so the agent still lacks NBC-specific offer truth, cases, qualification rules, objection doctrine, and proprietary methods. Post-call analysis measures and organizes conversations; it does not replace that knowledge. New provider-enriched results begin with calls made after analysis v1 was activated. Existing final calls retain phrase-based analysis unless a deliberate backfill is added later.
