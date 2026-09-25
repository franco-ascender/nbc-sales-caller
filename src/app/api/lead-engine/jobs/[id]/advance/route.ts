import { handleJobs } from '@/services/lead-engine-jobs-http';
// One bounded step of a running job. Paid calls inside go through lead_engine_meter first.
export const maxDuration = 60;
export async function POST(request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> { return handleJobs('advance', request, (await context.params).id); }
