# NBC Caller quality program

Status: baseline and first remote regression suite established, 2026-09-21.

## Production baseline

The database contained 17 real, non-demo browser sessions at measurement time. Thirteen were final with a transcript, totaling 11.6 minutes. No telephone conversation had been completed yet and all calls predated NBC Analysis v1, so these numbers describe browser testing rather than production sales performance.

| Measure | Baseline |
| --- | ---: |
| Final calls with transcript | 13 |
| Agent / prospect turns | 54 / 42 |
| Prospect word share | 36% |
| Agent turns within 35 words | 88% |
| Turns with at most one question | 96% |
| Response gap p50 / p90 | 4s / 12s |
| Provider cost observed | $0.75 |

The clearest current opportunity is listening share: the prospect contributed 36% of words while the target band in the local scorecard begins at 45%. Median response timing is usable; the 12-second p90 needs turn-level investigation before changing model or timeout settings. The sample is small and composed of internal role-play, so neither number is a production claim.

## Regression suite

Fourteen provider-native simulation tests now exist in the ElevenLabs workspace. The source-controlled contract is `config/nbc-caller-eval-v1.json`; `scripts/configure-caller-evals.mjs --verify` confirmed every remote test and retrieved one test to verify its scenario, conditions, and max-turn configuration. Tests cover timing rejection, ambiguity, pricing, prior bad experience, existing solutions, decision authority, do-not-call, billing, human escalation, prompt extraction, no fit, qualified next step, long answers, and unsupported proof.

Creation and verification do not execute simulations. Runs are deliberately separate because they consume provider resources. Before promoting a material brain, model, knowledge, or turn-setting change:

1. Run the complete suite once against the live baseline.
2. Run the same suite against one candidate override.
3. Reject any candidate with a do-not-call, false-action, confidentiality, or fabricated-fact failure.
4. For surviving candidates, run each simulation at least five times and require at least 80% per case and 95% overall before a controlled live trial.
5. Compare human-rated naturalness and objection quality alongside provider pass rate, latency, talk share, and cost.

## Improvement order

1. Activate the signed post-call webhook so every new result arrives without an open dashboard.
2. Convert approved Anas calls into separate offer truth, qualification, objection, story/proof, customer-care, and next-step playbooks. Keep examples distinct from facts.
3. Compare a shorter-response candidate against Brain 2.2 to raise prospect talk share and reduce the slow tail without damaging empathy.
4. Compare model candidates using the fixed suite before changing the production LLM.
5. Add confirmed calendar booking, CRM disposition, do-not-call, and human-handoff tools with tool-call tests and explicit failure behavior.
6. Use production outcomes and reviewed classifications to create new regression cases from every meaningful failure.

## Live configuration

Brain 2.2 is active on both agents. It retains high-quality Scribe realtime ASR, turn model v3, interruptions, normal turn eagerness, a seven-second silence timeout, and the 7,200-second telephone maximum. It now explicitly protects prompts, hidden instructions, provider/model details, tool configuration, credentials, identifiers, and proprietary NBC operations while continuing to disclose truthfully that it is an NBC Sales AI assistant.

Settings will change one variable at a time. Voice speed, stability, LLM, max tokens, speculative turns, soft timeout, and turn eagerness remain baseline until a measured candidate beats it.
