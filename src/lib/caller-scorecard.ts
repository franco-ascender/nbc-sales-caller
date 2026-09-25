import type { TranscriptTurn } from "./caller-types.ts";

export interface CallerScoreMetric { id: string; label: string; score: number; detail: string }
export interface CallerScorecard { overall: number; completeEnough: boolean; agentTurns: number; userTurns: number; averageResponseSeconds: number | null; metrics: CallerScoreMetric[]; coaching: string[] }

const words = (value: string): number => value.trim().split(/\s+/).filter(Boolean).length;
const percent = (passed: number, total: number): number => total ? Math.round(100 * passed / total) : 0;
const patterns = [
  { id: "current", pattern: /current|today|right now|currently|process|how do you|what are you doing/i },
  { id: "pain", pattern: /challenge|problem|frustrat|miss|struggl|bottleneck|not working|hardest/i },
  { id: "impact", pattern: /impact|cost|result|affect|consequence|how much|what happens/i },
  { id: "outcome", pattern: /goal|want|ideal|outcome|change|improve|success|look like/i },
  { id: "decision", pattern: /decision|involved|approve|timeline|priority|when would|who else/i },
  { id: "next", pattern: /next step|discovery|another conversation|follow up|calendar|meeting|call with/i },
] as const;

function listeningScore(userWords: number, totalWords: number): { score: number; share: number } {
  if (!totalWords) return { score: 0, share: 0 };
  const share = Math.round(100 * userWords / totalWords);
  if (share >= 45 && share <= 75) return { score: 100, share };
  return { score: Math.max(0, 100 - Math.abs(share - (share < 45 ? 45 : 75)) * 4), share };
}

export function scoreCallerConversation(transcript: readonly TranscriptTurn[]): CallerScorecard {
  const agent = transcript.filter(turn => turn.role === "agent"), user = transcript.filter(turn => turn.role === "user");
  const brevity = percent(agent.filter(turn => words(turn.message) <= 35).length, agent.length);
  const singleQuestion = percent(agent.filter(turn => (turn.message.match(/\?/g) ?? []).length <= 1).length, agent.length);
  const agentWords = agent.reduce((sum, turn) => sum + words(turn.message), 0), userWords = user.reduce((sum, turn) => sum + words(turn.message), 0);
  const listening = listeningScore(userWords, agentWords + userWords);
  const agentText = agent.map(turn => turn.message).join("\n");
  const covered = patterns.filter(item => item.pattern.test(agentText));
  const discovery = percent(covered.length, patterns.length);
  const nextStep = covered.some(item => item.id === "next") ? 100 : 0;
  const explicitStop = transcript.findIndex(turn => turn.role === "user" && /stop calling|do not call|don't call|remove me|end (the )?call|goodbye/i.test(turn.message));
  const stopRespected = explicitStop < 0 || !transcript.slice(explicitStop + 1).some(turn => turn.role === "agent" && turn.message.includes("?"));
  const gaps: number[] = [];
  for (let index = 1; index < transcript.length; index++) if (transcript[index].role === "agent" && transcript[index - 1].role === "user") gaps.push(Math.max(0, transcript[index].time_in_call_secs - transcript[index - 1].time_in_call_secs));
  const averageResponseSeconds = gaps.length ? Math.round(10 * gaps.reduce((sum, value) => sum + value, 0) / gaps.length) / 10 : null;
  const metrics: CallerScoreMetric[] = [
    { id: "brevity", label: "Concise turns", score: brevity, detail: `${agent.filter(turn => words(turn.message) <= 35).length}/${agent.length} agent turns stayed within 35 words.` },
    { id: "questions", label: "One question at a time", score: singleQuestion, detail: `${agent.filter(turn => (turn.message.match(/\?/g) ?? []).length <= 1).length}/${agent.length} turns avoided stacked questions.` },
    { id: "listening", label: "Prospect talk share", score: listening.score, detail: `The prospect contributed ${listening.share}% of spoken words.` },
    { id: "discovery", label: "Discovery coverage", score: discovery, detail: `${covered.length}/${patterns.length} conversation stages appeared.` },
    { id: "next", label: "Clear next step", score: nextStep, detail: nextStep ? "A next-step conversation was introduced." : "No explicit next step was detected." },
    { id: "stop", label: "Stop respected", score: stopRespected ? 100 : 0, detail: explicitStop < 0 ? "No explicit stop request occurred." : stopRespected ? "No sales question followed the stop request." : "A sales question followed an explicit stop request." },
  ];
  const weights: Record<string, number> = { brevity: .2, questions: .15, listening: .15, discovery: .3, next: .15, stop: .05 };
  const overall = Math.round(metrics.reduce((sum, metric) => sum + metric.score * weights[metric.id], 0));
  const coaching: string[] = [];
  if (brevity < 80) coaching.push("Shorten answers to one idea and one question.");
  if (singleQuestion < 90) coaching.push("Remove stacked questions so the prospect can answer naturally.");
  if (listening.share < 45) coaching.push("Create more space for the prospect to speak.");
  if (listening.share > 75) coaching.push("Reflect and guide the conversation instead of only collecting answers.");
  if (discovery < 67) coaching.push("Cover current state, pain, impact, desired outcome, decision context and next step.");
  if (!nextStep) coaching.push("End with a specific, truthful next step when there is fit.");
  return { overall, completeEnough: agent.length >= 3 && user.length >= 2, agentTurns: agent.length, userTurns: user.length, averageResponseSeconds, metrics, coaching };
}
