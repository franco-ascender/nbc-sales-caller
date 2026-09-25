import type { LeadPlanInput } from '@/lib/lead-engine-plan';
export interface LeadPlanStorageProps { input: LeadPlanInput; valid: boolean; mode?: 'search' | 'lists'; onOpen(input: LeadPlanInput): void }
