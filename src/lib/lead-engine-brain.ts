import brainFile from '../data/lead-engine-brain.json' with { type: 'json' };

// Phase 0 task 5: the routing brain. The app loads config/lead-engine-brain.json (the application copy of
// handoff/02_brain_v2.json plus legal_status per state), validates it once, and answers one question:
// route(industry, state) -> recipe, sources, expected clean rate, credits per cell and the legal gate.
// Numbers here are measurements, not settings: an entry with measured_by "anas" is only edited with a run
// of at least the same size. The Python package mirrors this file; tests/fixtures/brain-routes.json holds
// the shared vectors so both sides answer identically.

export type Recipe = 'A' | 'B' | 'C' | 'D';
export type LegalStatus = 'ok' | 'restricted' | 'prohibited';

export interface BrainIndustry {
  key: string; aliases: string[]; recipe: Recipe; keyword: string | null; allow: string | null;
  nameSource: Record<string, string>; expectedClean: number; expectedAny: number; n: number; measuredBy: string; notes: string | null;
  // Register ingest source ids (lead_engine_names.source) per state, '*' for nationwide files. Recipes C
  // and D pull names from here; a state without an entry is "register not ingested", not "no source".
  registerSource: Record<string, string>;
}
export interface BrainState { code: string; legalStatus: LegalStatus; legalNote: string | null; registryPhone: string[]; notes: string | null }
export interface BrainRecipe { key: Recipe; name: string; creditsPerCleanCell: number; paidSteps: string[] }
export interface Brain {
  version: string; creditValueUsd: number; spendCapRatio: number; rescrubDays: number;
  sample: { targetCells: number; abortBelowFractionOfExpected: number; defaultCities: string[] };
  unitCostsUsd: Record<string, number>; recipes: Record<Recipe, BrainRecipe>;
  industries: BrainIndustry[]; states: Record<string, BrainState>; outputColumns: string[];
  dialWindow: { start: string; end: string };
}
export interface BrainRoute {
  industry: string; state: string; recipe: Recipe;
  // The recipe the job runs when the register path is legally closed but Maps scraping still works.
  fallbackRecipe: Recipe | null; sources: string[]; expectedClean: number; expectedAny: number; n: number;
  measuredBy: string; creditsPerCleanCell: number; legalStatus: LegalStatus; legalNote: string | null; reason: string;
}

export class BrainError extends Error { constructor(message: string) { super(message); this.name = 'BrainError'; } }

const RECIPES: readonly Recipe[] = ['A', 'B', 'C', 'D'];
const STATE_CODE = /^[A-Z]{2}$/;
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const num = (value: unknown, label: string, min = 0, max = 1e9): number => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) throw new BrainError(`${label} must be a number between ${min} and ${max}`);
  return value;
};
const str = (value: unknown, label: string): string => { if (typeof value !== 'string' || !value.trim()) throw new BrainError(`${label} must be a non-empty string`); return value; };
const strings = (value: unknown): string[] => Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

export function normalizeIndustry(text: string): string {
  return text.toLowerCase().replace(/[_\-/,.()]+/g, ' ').replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
}

// Validates the whole file up front so a bad edit fails on boot, not on the first paid call.
export function loadBrain(raw: unknown = brainFile): Brain {
  if (!record(raw)) throw new BrainError('brain file must be an object');
  const version = str(raw.version, 'version');
  const creditValueUsd = num(raw.credit_value_usd, 'credit_value_usd', 0.01, 10);
  const spendCapRatio = num(raw.spend_cap_ratio, 'spend_cap_ratio', 0.05, 1);
  const rescrubDays = num(raw.rescrub_days, 'rescrub_days', 1, 365);
  if (!record(raw.sample)) throw new BrainError('sample missing');
  const sample = {
    targetCells: num(raw.sample.target_cells, 'sample.target_cells', 1, 1000),
    abortBelowFractionOfExpected: num(raw.sample.abort_if_clean_rate_below_fraction_of_expected, 'sample.abort', 0.05, 1),
    defaultCities: strings(raw.sample.default_cities),
  };
  if (sample.defaultCities.length === 0) throw new BrainError('sample.default_cities empty');
  if (!record(raw.unit_costs_usd)) throw new BrainError('unit_costs_usd missing');
  const unitCostsUsd: Record<string, number> = {};
  for (const [key, value] of Object.entries(raw.unit_costs_usd)) if (typeof value === 'number') unitCostsUsd[key] = num(value, `unit_costs_usd.${key}`, 0, 100);
  for (const required of ['scrape_per_business', 'verify_per_number', 'trace_per_person']) if (!(required in unitCostsUsd)) throw new BrainError(`unit_costs_usd.${required} missing`);

  if (!record(raw.recipes)) throw new BrainError('recipes missing');
  const recipes = {} as Record<Recipe, BrainRecipe>;
  for (const key of RECIPES) {
    const entry = raw.recipes[key];
    if (!record(entry)) throw new BrainError(`recipe ${key} missing`);
    const steps = Array.isArray(entry.steps) ? entry.steps : [];
    recipes[key] = {
      key, name: str(entry.name, `recipe ${key} name`), creditsPerCleanCell: num(entry.credits_per_clean_cell, `recipe ${key} credits`, 1, 100),
      paidSteps: steps.filter(record).filter(step => step.paid === true).map(step => String(step.step)),
    };
  }

  if (!record(raw.industries)) throw new BrainError('industries missing');
  const industries: BrainIndustry[] = [];
  for (const [key, entry] of Object.entries(raw.industries)) {
    if (!record(entry)) throw new BrainError(`industry ${key} must be an object`);
    const recipe = entry.recipe;
    if (typeof recipe !== 'string' || !RECIPES.includes(recipe as Recipe)) throw new BrainError(`industry ${key} recipe must be A-D`);
    const nameSource: Record<string, string> = {};
    if (record(entry.name_source)) for (const [state, source] of Object.entries(entry.name_source)) if (typeof source === 'string') nameSource[state] = source;
    const registerSource: Record<string, string> = {};
    if (record(entry.register_source)) for (const [state, source] of Object.entries(entry.register_source)) {
      if (typeof source !== 'string' || !/^[a-z0-9_.:-]{1,80}$/.test(source)) throw new BrainError(`industry ${key} register_source.${state} must be a source id`);
      registerSource[state] = source;
    }
    industries.push({
      key, aliases: strings(entry.aliases).map(normalizeIndustry), recipe: recipe as Recipe,
      keyword: typeof entry.keyword === 'string' ? entry.keyword : null, allow: typeof entry.allow === 'string' ? entry.allow : null,
      nameSource, registerSource, expectedClean: num(entry.expected_clean, `industry ${key} expected_clean`, 0, 1),
      expectedAny: num(entry.expected_any ?? entry.expected_clean, `industry ${key} expected_any`, 0, 1),
      n: num(entry.n ?? 0, `industry ${key} n`, 0, 1e7), measuredBy: typeof entry.measured_by === 'string' ? entry.measured_by : 'unknown',
      notes: typeof entry.notes === 'string' ? entry.notes : null,
    });
  }
  if (industries.length === 0) throw new BrainError('no industries');

  if (!record(raw.states)) throw new BrainError('states missing');
  const states: Record<string, BrainState> = {};
  for (const [code, entry] of Object.entries(raw.states)) {
    if (!STATE_CODE.test(code) || !record(entry)) continue;
    const legal = entry.legal_status ?? 'ok';
    if (legal !== 'ok' && legal !== 'restricted' && legal !== 'prohibited') throw new BrainError(`state ${code} legal_status invalid`);
    states[code] = {
      code, legalStatus: legal, legalNote: typeof entry.legal_note === 'string' ? entry.legal_note : null,
      registryPhone: strings(entry.registry_phone), notes: typeof entry.notes === 'string' ? entry.notes : null,
    };
  }
  const outputColumns = strings(raw.output_columns);
  for (const column of ['Cell Phone', 'Time Zone', 'Called', 'Outcome', 'Ledger Id']) if (!outputColumns.includes(column)) throw new BrainError(`output_columns missing ${column}`);
  if (!record(raw.dial_window_local)) throw new BrainError('dial_window_local missing');
  const dialWindow = { start: str(raw.dial_window_local.start, 'dial start'), end: str(raw.dial_window_local.end, 'dial end') };
  if (dialWindow.start < '08:00' || dialWindow.end > '20:00') throw new BrainError('dial window must sit inside 08:00-20:00');
  return { version, creditValueUsd, spendCapRatio, rescrubDays, sample, unitCostsUsd, recipes, industries, states, outputColumns, dialWindow };
}

let cached: Brain | null = null;
export function brain(): Brain { return cached ??= loadBrain(); }

interface Match { industry: BrainIndustry; score: number }

// Longest exact key or alias wins; then an alias contained in the text; then the text contained in an alias
// (so "contractors" finds the "contractors WA/OR/CA" family). Ties prefer the entry that names the state.
export function matchIndustry(text: string, state: string, source: Brain = brain()): BrainIndustry | null {
  const wanted = normalizeIndustry(text);
  if (!wanted) return null;
  const matches: Match[] = [];
  for (const industry of source.industries) {
    const names = [normalizeIndustry(industry.key), ...industry.aliases];
    let score = 0;
    for (const name of names) {
      if (name === wanted) score = Math.max(score, 1000 + name.length);
      else if (wanted.includes(name) && new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(wanted)) score = Math.max(score, 500 + name.length);
      else if (name.includes(wanted) && new RegExp(`\\b${wanted.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(name)) score = Math.max(score, 100 + wanted.length);
    }
    if (score === 0) continue;
    if (state in industry.nameSource || '*' in industry.nameSource) score += 10;
    if (industry.measuredBy === 'anas') score += 1;
    matches.push({ industry, score });
  }
  matches.sort((a, b) => b.score - a.score);
  return matches[0]?.industry ?? null;
}

export function route(industryText: string, stateInput: string, source: Brain = brain()): BrainRoute {
  const state = stateInput.trim().toUpperCase();
  if (!STATE_CODE.test(state)) throw new BrainError('state must be a two-letter code');
  const industry = matchIndustry(industryText, state, source);
  if (!industry) throw new BrainError(`no industry in the brain matches "${industryText}"`);
  const stateEntry = source.states[state] ?? { code: state, legalStatus: 'ok' as LegalStatus, legalNote: null, registryPhone: [], notes: null };
  const sources = industry.recipe === 'A'
    ? [industry.keyword ? `Google Maps: ${industry.keyword}` : 'Google Maps']
    : [industry.nameSource[state] ?? industry.nameSource['*']].filter((item): item is string => Boolean(item));
  let recipe = industry.recipe, legalStatus: LegalStatus = 'ok', legalNote: string | null = null, reason = `${industry.key}: recipe ${industry.recipe}`;
  let fallbackRecipe: Recipe | null = null;
  if (industry.recipe !== 'A') {
    // Register recipes need a source for this state and a state where sourcing licensees is legal.
    if (sources.length === 0) { reason = `${industry.key}: no ${industry.recipe} source for ${state}`; recipe = industry.recipe; legalStatus = 'restricted'; legalNote = `No name source for ${state}. Recipe A only.`; fallbackRecipe = 'A'; }
    if (stateEntry.legalStatus !== 'ok') {
      legalStatus = stateEntry.legalStatus; legalNote = stateEntry.legalNote;
      if (stateEntry.legalStatus === 'prohibited') { fallbackRecipe = 'A'; reason = `${industry.key}: licensee lists prohibited in ${state}`; }
    }
  }
  return {
    industry: industry.key, state, recipe, fallbackRecipe, sources, expectedClean: industry.expectedClean, expectedAny: industry.expectedAny,
    n: industry.n, measuredBy: industry.measuredBy, creditsPerCleanCell: source.recipes[recipe].creditsPerCleanCell, legalStatus, legalNote, reason,
  };
}

// A register_source id may carry a filter after a colon ("nppes:dentist", "fl_re:property_management"):
// the names step reads the adapter's rows whose business_type contains the filter words.
export function splitRegisterSource(id: string): { source: string; filter: string | null } {
  const [source, ...rest] = id.split(':');
  const filter = rest.join(':').replace(/_/g, ' ').trim();
  return { source, filter: filter || null };
}

// The register the names step reads for an industry in a state: the state's own file, else a nationwide one.
export function registerSourceFor(industryKey: string, state: string, source: Brain = brain()): string | null {
  const industry = source.industries.find(item => item.key === industryKey);
  if (!industry) return null;
  return industry.registerSource[state.toUpperCase()] ?? industry.registerSource['*'] ?? null;
}
export function registerSources(source: Brain = brain()): Array<{ industry: string; state: string; source: string }> {
  return source.industries.flatMap(industry => Object.entries(industry.registerSource).map(([state, id]) => ({ industry: industry.key, state, source: id })));
}

export interface CoverageCell { industry: string; state: string; recipe: Recipe; legalStatus: LegalStatus; available: boolean; expectedClean: number; measuredBy: string }

// The UI grey-out grid: every industry against the states the brain knows.
export function coverage(source: Brain = brain()): CoverageCell[] {
  const cells: CoverageCell[] = [];
  for (const industry of source.industries) for (const state of Object.keys(source.states).sort()) {
    const answer = route(industry.key, state, source);
    cells.push({ industry: industry.key, state, recipe: answer.recipe, legalStatus: answer.legalStatus, available: answer.legalStatus !== 'prohibited' && (answer.recipe === 'A' || answer.sources.length > 0), expectedClean: answer.expectedClean, measuredBy: answer.measuredBy });
  }
  return cells;
}

// Money helpers shared by the quote and the meter. 1 credit = $0.10; the engine may spend 60% of what is billed.
export function creditsForCells(targetCells: number, creditsPerCleanCell: number): number { return Math.ceil(targetCells * creditsPerCleanCell); }
export function capCentsForCredits(credits: number, source: Brain = brain()): number { return Math.floor(credits * source.creditValueUsd * 100 * source.spendCapRatio); }
