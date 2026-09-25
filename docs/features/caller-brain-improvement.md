# Caller brain — baseline and improvement path

Verified and updated against both live ElevenLabs agents on 2026-09-21. Brain V2 is active on the browser and telephone agents. They share the same behavioral core and model settings, with channel-specific context. They differ in maximum duration: 600 seconds for browser testing and the provider maximum of 7,200 seconds for telephone conversations.

## Current baseline

- Version: `brain-v2-2026-09-21`.
- Role: NBC Sales AI sales assistant, with separate private-roleplay and real-telephone context.
- Objective: have a useful sales conversation, understand the situation, determine credible fit and agree on a truthful next step.
- Guardrails: identify as AI, do not impersonate Anas, do not invent pricing, guarantees, testimonials, methodology or unavailable actions.
- Conversation style: staged but adaptive discovery, specific reflection, one question at a time, no interrogation or long pitch, most turns under 35 words.
- Objections: clarify, acknowledge, answer only from approved knowledge and ask one relevant follow-up.
- Model: GPT-4.1 Mini, temperature 0.35, maximum 140 output tokens.
- Voice: Anas's configured private voice through Eleven Flash v2; stability 0.5, similarity 0.8 and speed 1.
- Turn flow: turn_v3, normal eagerness and seven-second silence turn timeout.
- Knowledge: zero attached documents; RAG disabled.
- Privacy: provider voice recording disabled.

The voice clone supplies sound and delivery. It does not supply Anas's sales reasoning. Brain V2 improves the conversation method, but the agent still does not know NBC's actual ICP, offers, qualification rules, pricing, cases, objection doctrine or proprietary methodology.

## Evidence already available

The NBC database has 13 completed internal browser conversations with transcripts. Across them: 54 agent turns, 42 user turns, 27 words per agent turn on average, 12 responses above 35 words, a question in 76% of agent turns and an observed average turn gap near five seconds. All saved scenario-tagged sessions are outbound prospecting. This is sufficient for a baseline, but not representative of discovery, closing, follow-up and objection handling.

## Work that does not require historical calls

1. Create seven short, approved playbooks: offer truth, ICP, qualification/disqualification, conversation principles, objection handling, proof and prohibited claims, and next-step/handoff policy.
2. Run a structured interview with Anas and turn the answers into those playbooks. Keep facts separate from behavioral instructions.
3. Brain V2 now replaces the monolithic prompt with a concise sectioned prompt: identity, goal, conversation stages, listening rules, objection behavior, next step and guardrails. Future prompt changes must be measured against this version.
4. Build a fixed evaluation suite covering outbound prospecting, inbound, discovery, closing, follow-up, objections, interruptions, AI disclosure, pricing uncertainty, stop requests and irrelevant requests.
5. Score every version on first-audio latency, median/p95 turn gap, interruption errors, response length, discovery depth, unsupported claims and next-step quality.
6. A/B test model and turn-flow changes on the duplicate browser agent before modifying the telephone agent. Change one variable per experiment.
7. Use current internal transcripts as regression material. Historical Anas calls later provide style and judgment examples rather than the first usable dataset.

## Knowledge latency policy

Approved `playbook` sources attach in `prompt` mode so short critical facts are present every turn without retrieval. Approved `transcript` sources attach in `auto` mode and enable RAG. This avoids paying the RAG latency cost for the initial small core documents while preserving scale for the future call library.

## Anas brain-dump questions

1. Who is the best-fit prospect and who should the Caller disqualify?
2. What problem does NBC solve in the prospect's own language?
3. What must the Caller learn before suggesting a next step?
4. What signals indicate urgency, authority, budget and fit?
5. Which questions does Anas always ask, and which does he avoid?
6. What are the ten most common objections and the principle behind each response?
7. What claims, guarantees, prices or examples may the Caller state exactly?
8. What must never be said without a human present?
9. When should the Caller challenge, empathize, clarify or move on?
10. What makes a conversation successful even if no meeting is booked?
11. What exact next steps are valid today?
12. Which phrases sound unmistakably like Anas, and which sound wrong?

The pre-change configuration and verified Brain V2 state are stored privately in `artifacts/caller/brain-v2/`. The model and turn settings remain unchanged for the first comparison; only prompt structure, temperature, response cap and telephone duration changed.
