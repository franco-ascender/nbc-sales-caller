export const PILOT_ROUND = '2026-09-25-first-live-tests';
export type PilotState = 'dispatching'|'running'|'uncertain'|'completed'|'failed'|'stopped';
export interface PilotRow { name: string; city: string; state: string; website: string|null; sourceUrl: string|null; phone10: string|null; rejection: string|null; duplicate: boolean; chain: string|null }
export interface PilotResult {
  message?: string; rawBusinesses?: number; acceptedForReview?: number; rows?: PilotRow[];
  durationSeconds?: number; outcome?: string; summary?: string; transcript?: Array<{role:string;message:string}>;
  providerStatus?: string; voiceUsd?: number|null; agentUsd?: number|null; agentCredits?: number|null;
  costNote?: string; costComplete?: boolean; feedback?: string;
}
export interface PilotSlotView {
  key: string; kind: 'phone'|'scrape'; title: string; allocationCents: number; reserveCents: number;
  count: number|null; state: PilotState|'ready'; reportedMicrousd: number|null; result: PilotResult;
}
export interface PilotView {
  capCents: number; reservedCents: number; reportedMicrousd: number; availableCents: number;
  paused: boolean; pending: boolean; destinationLast4: string; slots: PilotSlotView[];
}
export function parsePilotAction(value: unknown): {action:'start'|'sync'|'stop'|'feedback'|'check'; key:string; feedback?:string} {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('Invalid action.');
  const b = value as Record<string,unknown>;
  if (Object.keys(b).some(k=>!['action','key','confirmed','feedback'].includes(k))
    || !['start','sync','stop','feedback','check'].includes(String(b.action)) || typeof b.key!=='string'
    || !/^(caller-[12]|(roofing|chiropractor|medspa)-(miami|charlotte))$/.test(b.key)
    || (b.action==='start' && b.confirmed!==true)
    || (b.action==='feedback' && (typeof b.feedback!=='string' || b.feedback.length>3000))) throw Error('Choose an approved test and confirm its displayed limit.');
  return {action:b.action as 'start'|'sync'|'stop'|'feedback'|'check',key:b.key,...(typeof b.feedback==='string'?{feedback:b.feedback}:{})};
}
