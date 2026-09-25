import { handleJobs } from '@/services/lead-engine-jobs-http';
export async function GET(request: Request): Promise<Response> { return handleJobs('score_report', request); }
