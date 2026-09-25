import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';

// Read local credentials without copying them into command-line arguments or output.
if (existsSync('.env.local')) loadEnvFile('.env.local');

async function readMetadata(provider, origin, path, token) {
  try {
    const response = await fetch(new URL(path, origin), {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      redirect: 'error',
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) {
      console.error(`${provider}: API returned ${response.status}; check token permissions and scope.`);
      process.exitCode = 1;
      return null;
    }
    return await response.json();
  } catch (error) {
    // Never print the request, token, or a provider response body.
    console.error(`${provider}: request failed (${error instanceof Error ? error.name : 'unknown error'}).`);
    process.exitCode = 1;
    return null;
  }
}

async function inspectSupabase() {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!token) { console.log('Supabase: awaiting SUPABASE_ACCESS_TOKEN in .env.local.'); return; }
  const orgs = await readMetadata('Supabase organizations', 'https://api.supabase.com', '/v1/organizations', token);
  if (Array.isArray(orgs)) console.log(JSON.stringify({ provider: 'supabase', organizations: orgs.map(org => ({ id: org.id, name: org.name })) }));
  const projects = await readMetadata('Supabase projects', 'https://api.supabase.com', '/v1/projects', token);
  if (Array.isArray(projects)) console.log(JSON.stringify({ provider: 'supabase', projects: projects.filter(project => !process.env.SUPABASE_ORGANIZATION_ID || project.organization_id === process.env.SUPABASE_ORGANIZATION_ID).map(project => ({ id: project.id, name: project.name, organizationId: project.organization_id, region: project.region, status: project.status })) }));
}

async function inspectVercel() {
  const token = process.env.VERCEL_TOKEN;
  if (!token) { console.log('Vercel: awaiting VERCEL_TOKEN in .env.local.'); return; }
  const teams = await readMetadata('Vercel teams', 'https://api.vercel.com', '/v2/teams?limit=100', token);
  if (Array.isArray(teams?.teams)) console.log(JSON.stringify({ provider: 'vercel', teams: teams.teams.map(team => ({ id: team.id, name: team.name, slug: team.slug })), hasMore: Boolean(teams.pagination?.next) }));
  const query = new URLSearchParams({ limit: '100' });
  if (process.env.VERCEL_TEAM_ID) query.set('teamId', process.env.VERCEL_TEAM_ID);
  const projects = await readMetadata('Vercel projects', 'https://api.vercel.com', `/v9/projects?${query}`, token);
  if (Array.isArray(projects?.projects)) console.log(JSON.stringify({ provider: 'vercel', scope: process.env.VERCEL_TEAM_ID || 'token default', projects: projects.projects.map(project => ({ id: project.id, name: project.name, framework: project.framework })), hasMore: Boolean(projects.pagination?.next) }));
}

await inspectSupabase();
await inspectVercel();
