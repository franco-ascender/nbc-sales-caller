import { cronAuthorized, runNightlyIngest } from '@/services/lead-engine-cron.service';

// Vercel Cron entry (see vercel.json). Free register ingest only; refused without the cron secret.
export const maxDuration = 60;
export async function GET(request: Request): Promise<Response> {
  if (!cronAuthorized(request)) return Response.json({ error: 'Cron secret required.' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  try { return Response.json(await runNightlyIngest(), { headers: { 'Cache-Control': 'no-store' } }); }
  catch (error) { return Response.json({ error: error instanceof Error ? error.message.slice(0, 200) : 'cron failed' }, { status: 503, headers: { 'Cache-Control': 'no-store' } }); }
}
