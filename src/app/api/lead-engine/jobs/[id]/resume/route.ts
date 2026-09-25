import { handleJobs } from '@/services/lead-engine-jobs-http';
export async function POST(request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> { return handleJobs('resume', request, (await context.params).id); }
