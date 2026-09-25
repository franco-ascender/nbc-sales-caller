import { handleRegisters } from '@/services/lead-engine-registers-http';
// Per-source summary for the registers panel: label, state, recipe, names, phones, last snapshot, run status.
export async function GET(request: Request): Promise<Response> { return handleRegisters('summary', request); }
