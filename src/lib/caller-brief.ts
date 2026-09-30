import type { ConversationScenario } from './caller-knowledge';
import { emptyCallerContext, contextCharacterCount } from './caller-context.ts';

export const BRIEF_CHARACTER_LIMIT = 22000;
export const briefLimits = { agentRole: 2500, offer: 1400, ticket: 2200, prospectProfile: 3300, objective: 2900, objections: 1400, instructions: 1800 } as const;
// Merge entire paragraphs only. Never remove a substring or rewrite a commercial fact.
function mergeFacts(...values: string[]): string {
  const seen = new Set<string>();
  return values.flatMap(value => value.split(/\n\s*\n/)).map(value => value.trim()).filter(value => {
    if (!value || seen.has(value)) return false;
    seen.add(value); return true;
  }).join('\n\n');
}
export function consolidateScenario(scenario: ConversationScenario): ConversationScenario {
  const context = scenario.context ?? emptyCallerContext();
  return { ...scenario, briefVersion: 2,
    agentRole: mergeFacts(scenario.agentRole, context.business),
    prospectProfile: mergeFacts(scenario.prospectProfile, context.leadSource),
    objective: mergeFacts(scenario.objective, context.nextStep),
    ticket: mergeFacts(scenario.ticket, context.boundaries),
    context: { ...context, business: '', leadSource: '', nextStep: '', boundaries: '' },
  };
}
export function briefCharacterCount(scenario: ConversationScenario): number {
  return Object.keys(briefLimits).reduce((count, key) => count + scenario[key as keyof typeof briefLimits].length, 0) + (scenario.context ? contextCharacterCount(scenario.context) : 0);
}
export function renderScenarioBrief(input: ConversationScenario): string {
  const s = consolidateScenario(input), c = s.context!;
  return [
    'BUSINESS & OFFER', `Business and representation: ${s.agentRole}`, `Offer and deliverables: ${s.offer}`,
    s.ticket ? `Pricing and commercial terms (only explicitly supplied facts are confirmed): ${s.ticket}` : 'Pricing and commercial terms: not supplied. Do not invent a price or guarantee.',
    c.proof ? `Approved evidence and differentiators: ${c.proof}` : '',
    'LEAD CONTEXT', `Prospect, origin and known situation: ${s.prospectProfile}`,
    c.qualification ? `Fit criteria and disqualifiers: ${c.qualification}` : '',
    'CONVERSATION GOAL', `Goal and next step: ${s.objective}`, `Conversation type: ${s.conversationType.replaceAll('_', ' ')}. Tone: ${s.tone}.`,
    s.instructions ? `Additional direction: ${s.instructions}` : '',
    'QUESTIONS & OBJECTIONS',
    s.objections ? `Prior concern notes (not approved answers): ${s.objections}` : '',
    ...c.answers.map((row, index) => `Approved ${row.kind} ${index + 1}\nProspect: ${row.question}\nAnswer guidance: ${row.answer}`),
  ].filter(Boolean).join('\n\n');
}
