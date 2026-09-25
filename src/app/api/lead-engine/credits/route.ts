import { handleJobs } from '@/services/lead-engine-jobs-http';
export async function GET(request: Request): Promise<Response> { return handleJobs('credits', request); }
// Internal top-up for the NBC operator. Client-facing purchases stay in the Usage module.
export async function POST(request: Request): Promise<Response> { return handleJobs('grant', request); }
