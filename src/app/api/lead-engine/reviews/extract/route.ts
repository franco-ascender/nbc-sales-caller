import { handleJobs } from '@/services/lead-engine-jobs-http';
// Free only: deterministic owner extraction from pasted text or a website's public pages. No paid call.
export async function POST(request: Request): Promise<Response> { return handleJobs('reviews_extract', request); }
