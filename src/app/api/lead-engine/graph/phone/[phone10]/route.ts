import { handleJobs } from '@/services/lead-engine-jobs-http';
export async function GET(request: Request, context: { params: Promise<{ phone10: string }> }): Promise<Response> { return handleJobs('graph_phone', request, (await context.params).phone10); }
