import { handleJobs } from '@/services/lead-engine-jobs-http';
export async function GET(request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> { return handleJobs('get', request, (await context.params).id); }
