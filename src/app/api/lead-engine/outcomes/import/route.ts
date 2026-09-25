import { handleJobs } from '@/services/lead-engine-jobs-http';
export async function POST(request: Request): Promise<Response> { return handleJobs('import', request); }
