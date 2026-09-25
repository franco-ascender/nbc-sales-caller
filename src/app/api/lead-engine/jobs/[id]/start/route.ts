import { handleJobs } from '@/services/lead-engine-jobs-http';
// Holds the quoted credits. The moment money is committed; an explicit operator click, never automatic.
export async function POST(request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> { return handleJobs('start', request, (await context.params).id); }
