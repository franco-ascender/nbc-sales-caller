export const PILOT_ROUND = '2026-09-25-first-live-tests';
export type PilotState = 'dispatching'|'running'|'uncertain'|'completed'|'failed'|'stopped';
export interface PilotRow { emails?: string[]; name: string; city: string; state: string; website: string|null; sourceUrl: string|null; phone10: string|null; rejection: string|null; duplicate: boolean; chain: string|null }
export interface PilotPhoneCheck { phone10: string; state: 'dispatching'|'completed'|'uncertain'; verification: import('./lead-engine-quality').LeadVerification|null }
export interface PilotResult {
  datasetCursor?:number; datasetTotal?:number; datasetComplete?:boolean; phoneEngine?:string; callStatus?:string; retellCostMicrousd?:number|null; retellComponents?:Array<{product:string;costMicrousd:number|null}>;
  message?: string; rawBusinesses?: number; acceptedForReview?: number; rows?: PilotRow[];
  durationSeconds?: number; outcome?: string; summary?: string; transcript?: Array<{role:string;message:string}>;
  ownerEvidence?: import('./run-owner-evidence').RegistryEvidence[]; registryTruncated?: boolean; phoneChecks?: PilotPhoneCheck[];
  providerStatus?: string; voiceUsd?: number|null; agentUsd?: number|null; agentCredits?: number|null;
  agentPlatformUsd?: number|null; agentLlmUsd?: number|null; latency?: import('./caller-measurements').LatencySummary|null; measuredAt?: string;
  costNote?: string; costComplete?: boolean; feedback?: string;
}
export interface PilotSlotView {
  emailsRequested?: boolean;
  key: string; businessCount?:number; verifiedMobileCount?:number; folderId?:string|null; canControl?:boolean; kind: 'phone'|'scrape'; title: string; allocationCents: number; reserveCents: number;
  scenarioTitle?:string; industry?: string; destinationLast4?: string; createdAt?: string; updatedAt?: string; count: number|null; state: PilotState|'ready'; reportedMicrousd: number|null; result: PilotResult;
}
export interface PilotView {
  phoneEngine?:'retell'|'elevenlabs';
  perOperationApproval?: boolean;
  capCents: number; reservedCents: number; reportedMicrousd: number; availableCents: number;
  verification?: {configured: boolean; unitCents: number|null; blocker: string|null}; booking?: {ready: boolean; reason: string}; paused: boolean; pending: boolean; destinationLast4: string; slots: PilotSlotView[];
}
export function parsePilotAction(value: unknown): {action:'start'|'sync'|'stop'|'feedback'|'check'|'verify'|'research'|'approve'; key:string; feedback?:string;approvedMaxCents?:number;approvalAction?:string} {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('Invalid action.');
  const b = value as Record<string,unknown>;
  if (Object.keys(b).some(k=>!['action','key','confirmed','feedback','approvedMaxCents','approvalAction'].includes(k))
    || !['start','sync','stop','feedback','check','verify','research','approve'].includes(String(b.action)) || typeof b.key!=='string'
    || !/^(caller-[12]|(?:dial|list)-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|(roofing|chiropractor|medspa)-(miami|charlotte))$/.test(b.key)
    || (['start','verify'].includes(String(b.action)) && b.confirmed!==true)
    || (b.action==='feedback' && (typeof b.feedback!=='string' || b.feedback.length>3000))) throw Error('Choose an approved test and confirm its displayed limit.');
  if(b.action==='approve'&&(b.confirmed!==true||!['start','verify'].includes(String(b.approvalAction))||!Number.isSafeInteger(b.approvedMaxCents)||Number(b.approvedMaxCents)<1))throw Error('Confirm the displayed maximum cost.');
  return {approvedMaxCents:b.approvedMaxCents as number|undefined,approvalAction:b.approvalAction as string|undefined,action:b.action as 'start'|'sync'|'stop'|'feedback'|'check'|'verify'|'research'|'approve',key:b.key,...(typeof b.feedback==='string'?{feedback:b.feedback}:{})};
}
