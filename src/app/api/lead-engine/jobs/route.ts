import { handleJobs } from '@/services/lead-engine-jobs-http';
export async function GET(request: Request): Promise<Response> { return handleJobs('list', request); }
export async function POST(request: Request): Promise<Response> { return handleJobs('create', request); }
