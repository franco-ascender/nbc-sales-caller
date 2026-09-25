# NBC Voice AI — Project Handoff Brief

**For:** Head of AI
**From:** Anas Daoud (Chief Ascender, NBC Sales / Ascenders)
**Updated:** September 12, 2026
**Purpose:** Continue the research, brainstorming, and build. This is the full context of what we're building, what matters, and where the research stands *as of today*. Models are moving weekly right now — the biggest spine candidate below shipped **two days ago**. Treat every specific model name as "verify before committing," but treat the *priorities and principles* as fixed.

---

## 0. THE ONE THING THAT OVERRIDES EVERYTHING

**We do not care about cost. We do not care about difficulty. We care about SPEED and VOICE QUALITY.**

The single reason people can tell they're talking to an AI is the response lag — that unnatural *pause-then-respond, pause-then-respond* rhythm. Kill that and we win. Every architectural decision, every vendor choice, every tradeoff gets resolved in favor of **lower latency and more human-sounding output**. If a decision saves money or effort but adds even ~150ms of perceptible lag or makes the voice slightly less human, we make the opposite decision.

The target feeling: a prospect hangs up and thinks *"holy shit, that sounded insane."* Real human inflection, natural enunciation, micro-responses ("uh-huh," "yeah, totally," "mm, gotcha"), playfulness, and — critically — the ability to be interrupted and jump back in without falling apart.

---

## 1. WHAT WE'RE BUILDING

An AI voice-calling product that replaces inside sales agents (ISAs / appointment setters) for marketing agencies. It calls inbound leads instantly, qualifies them, handles objections, and books the appointment — in **Anas's cloned voice**, trained on **Anas's sales methodology** (15+ years of phone selling: objection handling, word tracks, rebuttals, follow-up cadence). The methodology is the core IP; the voice clone of Anas is the second piece of IP. Everything else is rented commodity that we keep swappable.

When the AI gets stuck, it either **transfers to a live human** or **hands the conversation off to a text channel** (we already prototyped an iMessage texting line using LoopMessage + Claude — LoopMessage supplies the number and handles iMessage delivery).

### The three-product architecture (one shared "brain," three separate products)
Kept separate because different departments use each, and agency teams are often two partners (one front-end, one back-end). They talk to each other via API; the agency keeps its CRM as the hub.

1. **Product 1 — ISA / Speed-to-Lead (FLAGSHIP, build first).** Inbound. Instant call the moment a new lead hits the CRM. Qualify + book. Two channels off the same brain: a **voice agent** ("phone closer") and a **text agent** ("text closer" via LoopMessage/iMessage).
2. **Product 2 — Outbound + Rep Management.** Outbound AI setter (cold call / qualify) plus a dashboard that ingests human dialer stats, so mixed human+AI teams see everything in one branded place. Feeds calls into Product 3.
3. **Product 3 — Roleplay + Call Review Coach.** (a) A roleplay bot: reps practice against an adversarial AI "prospect." (b) Call review: transcript → LLM analysis → spoken feedback in Anas's cloned voice. The flywheel: reps practice → get coached → and eventually Product 1 replaces the weak ones.

*(Business/pricing model intentionally omitted — it's changing, likely a build-out plus per-appointment-booked model. Not a priority for the build. Focus is the build itself.)*

---

## 2. CRM — OPEN QUESTION (needs a recommendation)

Integration target is **not locked**. It can be **GoHighLevel** (agency-standard, white-label native) **or Close CRM**. Research both and recommend which is the better foundation for: instant lead-in webhooks, reliability of those webhooks, calendar/booking write-back, and clean white-label. GHL is the incumbent expectation in this market; Close is cleaner for sales-team workflows. Give a verdict.

---

## 3. THE MOAT — OWN vs. RENT (keep this discipline)

**OWN (portable, vendor-independent, never locked to a single provider):**
- The methodology wrapper logic (objection handling, word tracks, conversation flow)
- The voice clone of Anas
- The curated call training data + conversation state

**RENT (swappable commodities — pick the best today, swap when something better ships):**
- The LLM / speech model
- The voice model
- Telephony
- White-label dashboard/billing wrapper
- CRM

Design so that **any rented layer can be swapped with a config change, not a rebuild.** Given how fast this space is moving (see below), this discipline is doing real work — do not hard-couple to any single vendor.

---

## 4. THE MODEL LANDSCAPE — CURRENT AS OF SEPT 12, 2026

The big picture shifted twice this year, and once in the **last 48 hours**:

**First shift (earlier in 2026):** the raw-latency race at the top ended. Cartesia, Deepgram, Rime, ElevenLabs Flash and others all publish sub-100ms time-to-first-audio. The competitive surface moved to **emotional control, prosody, and naturalness** — exactly our differentiator.

**Second shift (mid-2026):** the whole market split from stitched pipelines toward **full-duplex speech-to-speech** — one model that *listens and speaks at the same time*, instead of the old "wait → guess you're done → start thinking → answer" turn-taking. This is the single most important architectural change for our "kill the pause" mandate.

**Third shift (Sept 10, 2026 — two days ago):** OpenAI released **GPT-Live-1 in the API**. This is now the leading spine candidate. Details below.

### 4a. THE SPINE — full-duplex speech-to-speech (this is the "no weird pause" lever)

**GPT-Live-1 (OpenAI) — NEW, released in the API Sept 10, 2026. Lead candidate.**
It collapses the old STT → reasoning → TTS chain into a single full-duplex model that listens and speaks simultaneously, handling interruptions *while it's generating audio*. The key architectural point for us: it **removes the "turn detector" from the audio path entirely** — the old tiny model that guesses when you've stopped talking (guess early = it cuts you off; guess late = it feels sluggish). That turn-detector is *the* source of the robotic pause we hate. GPT-Live-1 kills it. Reported ~30-point jump on Full Duplex Bench over the previous GPT-Realtime-2.1, response latency down to ~0.8s (from ~1.63s), and one early adopter (Speak) cut interruptions ~80% vs its old turn-based system. Priced at **$0.05/min for the voice layer**, billed per second.
- **The catch to design around:** GPT-Live-1 is deliberately *not* a reasoning model. It's the live conversation layer and **delegates hard thinking to a separate backend model** (OpenAI pairs it with GPT-6 Astra; you can wire your own). That means a **second bill and a second integration** — but it also means we keep control of the reasoning brain (good for the moat). Architecturally: GPT-Live-1 = the mouth and ears; our methodology-wrapped backend = the brain.
- **Caveat:** OpenAI has published no independent WER / leaderboard numbers for it yet. Verify with our own ear-test.

**Alternatives / challengers to test head-to-head:**
- **GPT-Realtime-2 / 2.1 (OpenAI)** — the previous-gen unified speech-to-speech with GPT-5-class reasoning built in (no separate backend needed). Still excellent, production-proven, simpler to wire than GPT-Live-1. If GPT-Live-1's two-model split adds latency or complexity in practice, this is the fallback spine.
- **Grok Voice "Think Fast 2.0" (xAI)** — fastest published response time (~0.70s), most benchmark-transparent (82.9% on Artificial Analysis speech-to-speech quality index, 56.5% on tau-voice, a customer-service-conversation benchmark). Genuinely worth a bake-off.
- **Gemini Live (Google)** — strong quality but benchmarked notably slower on full-duplex turn-taking in third-party tests. Lower priority for a latency-first product.
- **Microsoft MAI Realtime full-duplex** — exists, less proven for our use case. Watch, don't lead with it.

### 4b. THE VOICE — cloning Anas specifically

This is the nuance that matters most: leaderboards rank *generic* voice naturalness, but our whole thesis is cloning **Anas himself**, which is a different contest.
- **ElevenLabs Professional Voice Clone — still the cloning benchmark.** Fine-tuned on the source audio for maximum fidelity, "virtually indistinguishable from the original." Even competitors' healthcare products run ElevenLabs voices underneath. Cloning fidelity outranks generic-voice naturalness for us. **This is the default voice pick.**
- **Cartesia Sonic (3.5/4)** — the speed + no-drift option. ~40–90ms TTFA, cloning included (from ~3 sec of audio), and Sonic 3.5 specifically **fixed long-session voice drift** (critical for 10-minute calls). Test its clone of Anas against ElevenLabs.
- **Generic-naturalness leaders worth an ear-test (verify they clone *Anas* well):** Google Gemini 3.1 Flash TTS, Inworld Realtime TTS 1.5 Max, Alibaba Fun-Realtime-TTS.
- **Important architecture note:** if we go with GPT-Live-1 as the spine, the voice is *baked into* that model (12 voice options), so a separate ElevenLabs clone may not drop in directly. This is a real tradeoff to resolve: **GPT-Live-1's superior full-duplex timing vs. ElevenLabs' superior clone of Anas.** Two paths to test:
  1. **GPT-Live-1 end-to-end** — best timing/interruption handling, but Anas's voice only as well as GPT-Live can approximate it.
  2. **Modular (GPT-Realtime-2 or a stitched loop) + ElevenLabs clone** — best clone of Anas, slightly more latency risk.
  The ear-test decides. This is the single most important open technical question in the whole build.

### 4c. TRANSCRIPTION (for Product 3 review + any modular pipeline)
- **Deepgram Nova-3** (~150ms streaming, industry standard) or **ElevenLabs Scribe v2** (~2.2% WER, ASR leader). **GPT-Realtime-Whisper** is OpenAI's new streaming STT if we stay in their ecosystem.

### 4d. ORCHESTRATION / TELEPHONY (holds the stack together)
- **Retell** — now the front-runner for us, and the reason is HIPAA (see Section 5). Operationally strong too: warm transfer with full context passed to the human, native SIP, knowledge base for multi-turn accuracy, **verified numbers that reduce spam-flagging and lift answer rates** (real money on outbound), unlimited concurrent calls on every plan. ~$0.07/min.
- **Vapi** — best when the voice experience is core IP and you want BYO models (which is us on paper), biggest community. But two real drawbacks: HIPAA is a **$1,000/month add-on**, and non-enterprise support is Discord-only (production teams complain).
- **Verdict to pressure-test:** lean **Retell** primary given the medical ambition, **Vapi** as the BYO-flexibility alternative. Confirm both can host whichever spine we pick.

### Eliminated / avoid (with reasons)
- **Bland AI** — too much latency, dead-air pauses. Fails our #1 criterion.
- **Full custom telephony from scratch on raw Twilio** — 3–6 months for ~5–10% gain. Not the launch path.
- **Telnyx / PolyAI direct** — enterprise-only, slow onboarding, overkill for launch.
- **Delphi.ai** — async Q&A "digital mind," not adversarial roleplay. Redundant for Product 3.
- **Play.ht / PlayAI** — acquired by Meta, being wound down. Do not build on it.

### Wildcards
- **Self-hosted open-weights** (XTTS-v2, Kokoro, Miso Labs, etc.) — only worth it later for HIPAA data-sovereignty, if we want to own the whole stack on our own GPUs. Not the launch path, but the *strongest* long-term HIPAA moat (no third-party BAA needed if PHI never leaves our infrastructure).

---

## 5. COMPLIANCE — HIPAA IS NOW A PRIORITY (we want to sell to medical practices)

This is a first-class goal, not a "later" item. We want to be able to sell to med spas, clinics, and medical services, which means handling PHI, which means **HIPAA**. Here's the real picture:

**The Five-BAA Problem.** Every layer that touches PHI needs its own Business Associate Agreement: **Platform + LLM + STT + TTS + Telephony.** That's up to five separate BAAs to sign and maintain, and on developer-first platforms *you* are responsible for sourcing every one. One missing link = the whole thing is non-compliant. There is no government "HIPAA certified" stamp — compliance is a configuration + contracts state, not a badge.

**What this means for vendor choice (this is why Retell moved up):**
- **Retell** includes HIPAA on standard plans via a **self-service BAA portal at no extra charge**, states SOC 2 Type II, and has real healthcare deployments. This dramatically lowers the friction vs. competitors. (Caveat: it's BYO-carrier via Twilio/Vonage, so telephony compliance is a separate procurement step, and full compliance still requires correct customer-side configuration across the stack.)
- **Vapi** — HIPAA is a **$1,000/month add-on**.
- **ElevenLabs** — BAA is **Enterprise-tier only**, paired with zero-retention mode; PHI must not flow until that's in place.
- **VoiceAIWrapper** (white-label dashboard option) — is itself HIPAA-compliant and offers a BAA on-demand for Enterprise, and white-labels HIPAA-capable providers (Vapi, Retell, ElevenLabs, Deepgram) under our brand.

**The nasty collision to design around:** enabling HIPAA / zero-retention mode on some platforms **disables call recording and transcripts** — which would break Product 3's coaching (it needs transcripts). We need a compliant transcript path (e.g., zero-retention on the vendor + our own encrypted, BAA-covered storage) or Product 3 runs only on non-PHI verticals. Resolve this explicitly.

**Requirements checklist for a HIPAA deployment:** BAA at every PHI-touching layer, SOC 2 Type II, AES-256 at rest, TLS in transit, SSO/MFA, audit logging, access controls, and a defined data-retention policy. For booking into medical systems, use HIPAA-grade middleware (e.g., NexHealth, Redox) rather than touching an EHR directly.

**Recommended sequencing:** launch Product 1 on a **non-PHI vertical first** (home services / roofing) to prove the build and the voice quality, then stand up the **HIPAA-compliant configuration as a premium tier** for medical — same architecture, compliant vendors + BAAs + zero-retention wired in. Building HIPAA-ready from day one (compliant vendor choices, no PHI in logs) is cheaper than retrofitting, so **make vendor choices now that don't block the HIPAA path** even if we launch non-medical first.

---

## 6. THE LATENCY DISCIPLINE (the real engineering brief)

Because speed is priority #1, here's what "build it fast" actually means:

1. **Prefer a full-duplex speech-to-speech spine over a stitched STT→LLM→TTS pipeline.** Full-duplex (GPT-Live-1, GPT-Realtime-2, Grok Voice) removes the turn-detector and the inter-service handoffs where lag hides. This is the main "no weird pause" lever.
2. **Budget the WHOLE pipeline, not the model.** Set a hard end-to-end target and measure round-trip on *real phone calls*, not vendor demo pages. Vendor "40ms TTFA" numbers are lab conditions; the real number includes telephony, network, and (for GPT-Live-1) the backend-reasoning hop.
3. **Mind the GPT-Live-1 backend hop.** Its low latency assumes a fast backend model. If our methodology brain is heavy, that second call can reintroduce lag. Test the paired latency, not just the voice-layer number.
4. **Stream everything.** WebSocket/WebRTC, chunked audio, start speaking before the full response is generated. No batch/REST in the live loop.
5. **Barge-in / interruption is non-negotiable.** The AI must stop instantly when the prospect talks and recover naturally. Full-duplex models handle this best — it's a top reason to prefer them.
6. **Co-locate services / minimize network hops.** Keep LLM, voice, and telephony in the same region.
7. **Micro-responses to cover think-time** ("uh-huh," "right," "mm-hmm") so no silence ever sounds dead.
8. **Verify no voice drift on long calls** — confirm the chosen voice holds its clone over a full 10-minute call.
9. **Run our own head-to-head ear-test** — never trust a leaderboard for the final call.

---

## 7. THE BUILD SEQUENCE & DIVIDE-AND-CONQUER

**Timeline estimate:** Product 1 ~2–3 weeks; Product 2 ~1–2 weeks after; Product 3 ~1 week. The genuinely hard parts: conversation state shared across the voice + text channels, and CRM webhook reliability (build retry + dedup on the webhook).

**The handoff contract (agree Day 1, unblocks parallel work):**
The brain exposes one function — `get_next_line(conversation_history) → next line as text`. The methodology fills what it returns. **The voice decision does NOT block the engineering build**, because in a modular design the brain outputs text and the voice is the "last inch of the pipe" — build with a placeholder, swap the winner in at the end as a config change. **One update for 2026:** if we choose a full-duplex spine (GPT-Live-1 / GPT-Realtime-2), the "brain outputs text → voice speaks it" separation partly collapses into the model. Mitigation: still architect the methodology as a separate backend brain that the full-duplex layer calls — this preserves the moat *and* keeps voice swappable. Agree which path Day 1.

**Track A — Voice & Methodology (Anas owns):**
1. Gather ~50 best real calls per vertical + 3–5 min of clean audio of Anas + pick the first (non-healthcare) vertical.
2. Open accounts across the top candidates; clone Anas's voice where supported.
3. **The ear-test** (Section 8).
4. Author the methodology (develop and test in a plain chat window first — no voice needed).
5. Be the quality ear on every test call.

**Track B — Brain & Infrastructure (Head of AI / engineering owns):**
1. Lock the handoff contract; open accounts (spine model, backend LLM, telephony, transcription, Postgres/Supabase for state).
2. Build the methodology-wrapped backend brain + conversation-state DB + the three modes (local-lead-gen / B2B / roleplay).
3. Build the orchestration server: CRM webhook in (retry + dedup) → place call → conversation loop → booking → write back to CRM + log minutes → LoopMessage text channel sharing the same conversation state.
4. Build the white-label dashboard + client onboarding. **Make HIPAA-safe choices here from the start** (no PHI in plain logs, compliant vendors).
5. Swap in the real voice + methodology; joint live testing with Anas.

---

## 8. THE EAR-TEST (how we make the final call)

Take **one objection-heavy 60-second script** and run it **identically** through every finalist:
- **Spine bake-off:** GPT-Live-1 (with our backend) vs. GPT-Realtime-2 vs. Grok Voice Think Fast 2.0.
- **Voice bake-off:** GPT-Live-1's native voice vs. ElevenLabs clone vs. Cartesia clone of Anas.

Listen for: (a) lag / dead air, (b) natural micro-responses, (c) emotional inflection on questions and objections, (d) how it handles being interrupted mid-sentence, (e) whether it actually sounds like Anas. Pick a **winner + a backup**. The leaderboard narrows the field; **the ear makes the decision.**

---

## 9. TRAINING APPROACH (so it sounds like Anas, not "an AI")

- Feed ~**50 best calls per industry** so the model reverse-engineers Anas's cadence, objections, and rebuttals. **Do NOT** dump hundreds of hours of coaching + selling — it adds noise and dilutes signal.
- **One brain, many modes** — a single frontier LLM wrapped with the NBC methodology, system prompt setting the mode per vertical. NOT separate fine-tunes per use case. New verticals = new prompt + new call data, not a new model.
- Voice cloning is a **separate** track from methodology training — needs only 30 sec to a few minutes of clean audio.

---

## 10. OPEN DECISIONS FOR THE HEAD OF AI TO DRIVE

1. **Re-verify the model landscape today** — GPT-Live-1 is 2 days old; expect more. Names above may already have moved.
2. **The core spine question:** GPT-Live-1 (best timing, needs separate backend brain + 2nd bill) vs. GPT-Realtime-2 (unified, simpler, reasoning built in) vs. Grok Voice. Decide via bake-off.
3. **The core voice question:** GPT-Live-1's native voice (best timing) vs. ElevenLabs clone of Anas (best fidelity) — the single most important tradeoff in the build.
4. **HIPAA architecture:** which vendors give clean BAAs (Retell's self-service portal is the current front-runner), and how to keep Product 3 transcripts while staying compliant.
5. **Orchestration:** Retell (HIPAA-friendly, outbound-strong) vs. Vapi (BYO, but $1k/mo HIPAA).
6. **CRM verdict:** GoHighLevel vs. Close.
7. **Dashboard:** off-the-shelf white-label wrapper (e.g., VoiceAIWrapper, itself HIPAA-capable) vs. fully custom.
8. **Backend reasoning LLM + data-retention terms** (OpenAI vs. Anthropic vs. other), with an eye on the HIPAA BAA.
9. **Exact CRM speed-to-lead trigger spec** (which pipeline stage; call-first vs. text-first).
10. **First launch vertical** (non-PHI), with the HIPAA/medical tier as the fast-follow.

---

*Everything above is a snapshot dated Sept 12, 2026. The priorities — speed first, human-quality voice second, own-the-methodology-and-clone, rent-everything-else, HIPAA-ready by design — are the fixed part. The specific vendors are the part to re-verify before committing a dollar, because this market is moving faster right now than at any point this year.*
