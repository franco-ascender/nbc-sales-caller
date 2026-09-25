import 'server-only';
import { database, IntegrationError, readJson, apiError } from './integration.service';
import { requireLeadOperator } from './lead-engine-auth';
import { LeadEngineError, leadRecord, leadUuid } from '../lib/lead-engine-storage';
import { parseJobInput, parseOutcomeBody, quoteJob } from '../lib/lead-engine-jobs';
import { coverage, brain } from '../lib/lead-engine-brain';
import brainFile from '../data/lead-engine-brain.json' with { type: 'json' };
import workflowReviews from '../data/lead-engine-workflows.json' with { type: 'json' };
import { inspectWorkflowRoutes } from '../lib/lead-engine-workflow-routing';
import { advanceJob, createJob, creditBalance, getJob, grantCredits, jobWorkbook, listJobs, resumeJob, startJob, vendorsFromEnv } from './lead-engine-jobs.service';
import { importOutcomes, recordOutcome } from './lead-engine-outcomes.service';
import { assertFresh, jobFreshness, workbookListToCsv } from './lead-engine-export.service';
import { phoneNeighborhood } from './lead-engine-graph.service';
import { extractOwnerFromWebsite } from './lead-engine-reviews.service';
import { extractOwnerFromText, pickOwnerName } from '../lib/lead-engine-reviews';
import { leadStorageError } from '../lib/lead-engine-storage';

// One handler for the job, credit, outcome and coverage routes. Every action authenticates the operator
// first and touches nothing before that. Paid actions (advance) are explicit operator clicks; nothing
// here runs on a schedule.
export type JobAction = 'list' | 'quote' | 'create' | 'get' | 'start' | 'advance' | 'resume' | 'download' | 'credits' | 'grant' | 'outcome' | 'import' | 'coverage' | 'brain'
  | 'score_report' | 'graph_phone' | 'reviews_extract';

const headers = { 'Cache-Control': 'no-store' };
function db() { try { return database(); } catch { throw new LeadEngineError(503, 'storage_pending', 'Storage is pending configuration.'); } }
async function operatorOf(request: Request): Promise<string> {
  try { return await requireLeadOperator(request); }
  catch (error) { throw error instanceof IntegrationError ? new LeadEngineError(error.status, 'access_pending', error.message) : error; }
}
function jobId(id: string | undefined): string { if (!leadUuid(id)) throw new LeadEngineError(400, 'invalid_input', 'A valid job id is required.'); return id.toLowerCase(); }

export async function handleJobs(action: JobAction, request: Request, id?: string): Promise<Response> {
  try {
    const operator = await operatorOf(request);
    let result: unknown;
    switch (action) {
      case 'coverage': result = { version: brain().version, industries: brain().industries.map(item => ({ key: item.key, recipe: item.recipe, aliases: item.aliases, expectedClean: item.expectedClean, measuredBy: item.measuredBy, n: item.n })), states: Object.values(brain().states), cells: coverage() }; break;
      case 'brain': {
        // Admin view of the routing brain: every industry with its logic, the four recipes step by step, the legal gate per state.
        const source = brain(); const raw = brainFile as unknown as Record<string, unknown>;
        const wired: Record<string, boolean> = { A: true, B: true, C: true, D: true };
        result = {
          version: source.version, about: raw._about, configNote: raw._config_note, creditValueUsd: source.creditValueUsd, spendCapRatio: source.spendCapRatio, rescrubDays: source.rescrubDays,
          sample: source.sample, unitCostsUsd: source.unitCostsUsd, dialWindow: source.dialWindow, guardrails: raw.guardrails, outputColumns: source.outputColumns,
          recipes: Object.values(source.recipes).map(recipe => ({ ...recipe, wired: wired[recipe.key], raw: (raw.recipes as Record<string, unknown>)[recipe.key] })),
          industries: source.industries.map(item => ({ key: item.key, recipe: item.recipe, wired: wired[item.recipe], aliases: item.aliases, keyword: item.keyword, allow: item.allow, nameSource: item.nameSource, registerSource: item.registerSource,
            expectedClean: item.expectedClean, expectedAny: item.expectedAny, n: item.n, measuredBy: item.measuredBy, notes: item.notes, effectiveRoutes: inspectWorkflowRoutes(item.key) })),
          states: Object.values(source.states), workflowReviews,
        }; break;
      }
      case 'credits': result = await creditBalance(db(), operator); break;
      case 'grant': {
        const body = await readJson(request);
        if (!leadRecord(body) || typeof body.credits !== 'number') throw new LeadEngineError(400, 'invalid_input', 'credits (number) is required.');
        result = await grantCredits(db(), operator, body.credits, typeof body.note === 'string' ? body.note : 'internal grant'); break;
      }
      case 'list': result = { jobs: await listJobs(db(), operator) }; break;
      case 'quote': {
        // A preview: same validation as create, no row written, no credits touched.
        const body = await readJson(request);
        if (!leadRecord(body)) throw new LeadEngineError(400, 'invalid_input', 'A job object is required.');
        const input = parseJobInput({ ...body, id: '00000000-0000-4000-8000-000000000000' });
        result = { quote: quoteJob(input), balance: await creditBalance(db(), operator) }; break;
      }
      case 'create': result = await createJob(db(), operator, parseJobInput(await readJson(request))); break;
      case 'get': result = await getJob(db(), operator, jobId(id)); break;
      case 'start': result = { job: await startJob(db(), operator, jobId(id)) }; break;
      case 'advance': result = await advanceJob(db(), operator, jobId(id), vendorsFromEnv()); break;
      case 'resume': {
        const body = await readJson(request);
        const extra = leadRecord(body) && typeof body.extraCredits === 'number' ? body.extraCredits : 0;
        result = { job: await resumeJob(db(), operator, jobId(id), extra) }; break;
      }
      case 'download': {
        // Anas §8: a list older than 31 days is stale; refuse unless the operator overrides (email use).
        const query = new URL(request.url).searchParams;
        assertFresh(await jobFreshness(db(), operator, jobId(id)), query.get('override') === '1');
        const file = await jobWorkbook(db(), operator, jobId(id));
        if (query.get('format') === 'csv') {
          return new Response(workbookListToCsv(file.bytes), { headers: { ...headers, 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${file.filename.replace(/\.xlsx$/, '.csv')}"` } });
        }
        return new Response(new Uint8Array(file.bytes), { headers: { ...headers, 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename="${file.filename}"` } });
      }
      case 'outcome': result = await recordOutcome(db(), operator, parseOutcomeBody(await readJson(request))); break;
      case 'import': {
        const bytes = new Uint8Array(await request.arrayBuffer());
        if (bytes.length === 0) throw new LeadEngineError(400, 'invalid_file', 'Send the .xlsx file as the request body.');
        result = await importOutcomes(db(), operator, bytes); break;
      }
      // Phase 5: the weekly Owner Probability Score report (reached-owner rate by bucket, recipe, source, state).
      case 'score_report': {
        const { data, error } = await db().rpc('lead_engine_score_report', { p_operator: operator });
        if (error) throw leadStorageError(error);
        result = data; break;
      }
      // Phase 5: the entity graph around one phone (persons, businesses, licenses, places), two hops.
      case 'graph_phone': result = await phoneNeighborhood(db(), (id ?? '').replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '')); break;
      // Phase 4 task 5, free half only: deterministic owner extraction from pasted text or a website. Never a paid call.
      case 'reviews_extract': {
        const body = await readJson(request);
        if (!leadRecord(body)) throw new LeadEngineError(400, 'invalid_input', 'Send { text } or { website }.');
        if (typeof body.text === 'string' && body.text.trim()) {
          const candidates = extractOwnerFromText(body.text.slice(0, 200000));
          result = { owner: pickOwnerName(candidates), candidates, source: 'text' };
        } else if (typeof body.website === 'string' && body.website.trim()) {
          result = { ...(await extractOwnerFromWebsite(body.website.trim().slice(0, 2000))), source: 'website' };
        } else throw new LeadEngineError(400, 'invalid_input', 'Send { text } or { website }.');
        break;
      }
    }
    return Response.json(result, { headers });
  } catch (error) {
    if (!(error instanceof LeadEngineError)) return apiError(error);
    return Response.json({ code: error.code, error: error.message }, { status: error.status, headers });
  }
}
