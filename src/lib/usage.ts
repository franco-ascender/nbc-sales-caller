export interface MeteredUsage {
  inputTokens: number | null;
  outputTokens: number | null;
  cachedTokens: number | null;
  seconds: number | null;
  costMicrousd: number | null;
  costScope: "unknown" | "llm_only" | "total";
}

const record = (value: unknown): Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const count = (value: unknown): number | null => typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= 1e9 ? value : null;
const unixSeconds = (value: unknown): number | null => typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= 100_000_000_000 ? value : null;
const amount = (value: unknown, maximum = 1e6): number | null => typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= maximum ? value : null;
const microusd = (value: unknown): number | null => {
  const dollars = amount(value);
  if (dollars === null) return null;
  const result = Math.round(dollars * 1e6);
  return Number.isSafeInteger(result) && result <= 1e12 ? result : null;
};

export function voiceUsage(payload: unknown): MeteredUsage {
  const root = record(payload), meta = record(root.metadata), charging = record(meta.charging), usage = record(charging.llm_usage), models = record(record(usage.irreversible_generation).model_usage);
  // Initiated generation includes speculative work; do not sum it with irreversible generation.
  const rows = Object.values(models).map(record);
  const sum = (keys: string[]): number | null => {
    const values = rows.flatMap(row => keys.map(key => count(record(row[key]).tokens)));
    return values.length && values.every(value => value !== null) ? values.reduce<number>((total, value) => total + (value ?? 0), 0) : null;
  };
  const totalCost = microusd(meta.cost_fiat);
  const llmCost = microusd(charging.llm_price);
  return {
    inputTokens: sum(["input"]),
    outputTokens: sum(["output_total"]),
    cachedTokens: sum(["input_cache_read", "input_cache_write"]),
    seconds: count(meta.call_duration_secs),
    costMicrousd: totalCost ?? llmCost,
    costScope: totalCost !== null ? "total" : llmCost !== null ? "llm_only" : "unknown",
  };
}

export function quoteCredits(costMicrousd: number, creditValueMicrousd: number, markupBps: number): number {
  if (![costMicrousd, creditValueMicrousd, markupBps].every(Number.isSafeInteger) || costMicrousd < 0 || costMicrousd > 1e12 || creditValueMicrousd < 1 || markupBps < 10000 || markupBps > 100000) throw Error("Invalid credit estimate");
  const numerator = BigInt(costMicrousd) * BigInt(markupBps), denominator = BigInt(creditValueMicrousd) * 10000n;
  return Number((numerator + denominator - 1n) / denominator);
}

export interface ProviderUsagePeriod { costMicrousd: number; seconds: number; credits: number }
export interface ProviderUsageDay extends ProviderUsagePeriod { date: string }
export interface ProviderUsageProduct extends ProviderUsagePeriod { label: string }
export interface ProviderUsageAvailable {
  status: "available";
  measuredAt: string;
  today: ProviderUsagePeriod;
  sevenDays: ProviderUsagePeriod;
  thirtyDays: ProviderUsagePeriod;
  daily: ProviderUsageDay[];
  products: ProviderUsageProduct[];
  account: {
    tier: string | null;
    creditsUsed: number | null;
    creditsLimit: number | null;
    creditsRemaining: number | null;
    currentOverageMicrousd: number | null;
    currency: string | null;
    resetsAt: string | null;
  };
}
export interface ProviderUsageUnavailable { status: "unavailable"; measuredAt: string }
export type ProviderUsageSnapshot = ProviderUsageAvailable | ProviderUsageUnavailable;

function emptyPeriod(): ProviderUsagePeriod { return { costMicrousd: 0, seconds: 0, credits: 0 }; }
function addPeriod(target: ProviderUsagePeriod, cost: number, seconds: number, credits: number): void {
  target.costMicrousd += cost; target.seconds += seconds; target.credits += credits;
}
function productLabel(value: string): string {
  if (value === "Conversational AI") return "Agent voice";
  if (value === "Conversational AI - LLM") return "Agent intelligence";
  if (value === "TTS") return "Voice generation";
  return "Other provider usage";
}

export function parseProviderUsage(analytics: unknown, subscription: unknown, now = Date.now()): ProviderUsageAvailable {
  const table = record(analytics), account = record(subscription);
  if (!Array.isArray(table.columns) || !table.columns.every(value => typeof value === "string") || !Array.isArray(table.rows)) throw Error("Invalid provider usage table");
  const columns = Object.fromEntries((table.columns as string[]).map((name, index) => [name, index]));
  for (const required of ["product_type", "timestamp", "total_usage", "total_minutes", "total_cost"]) if (!Number.isInteger(columns[required])) throw Error("Incomplete provider usage table");
  const date = new Date(now), todayStart = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  const starts = { today: todayStart, sevenDays: todayStart - 6 * 86400_000, thirtyDays: todayStart - 29 * 86400_000 };
  const periods = { today: emptyPeriod(), sevenDays: emptyPeriod(), thirtyDays: emptyPeriod() };
  const days = new Map<string, ProviderUsagePeriod>(), products = new Map<string, ProviderUsagePeriod>();
  for (const raw of table.rows) {
    if (!Array.isArray(raw)) continue;
    const timestamp = typeof raw[columns.timestamp] === "string" ? Date.parse(raw[columns.timestamp] as string) : NaN;
    const product = typeof raw[columns.product_type] === "string" ? productLabel(raw[columns.product_type] as string) : "Other provider usage";
    const credits = amount(raw[columns.total_usage], 1e12), minutes = amount(raw[columns.total_minutes], 1e9), cost = microusd(raw[columns.total_cost]);
    if (!Number.isFinite(timestamp) || credits === null || minutes === null || cost === null || timestamp < starts.thirtyDays || timestamp > now + 86400_000) continue;
    const seconds = Math.round(minutes * 60), roundedCredits = Math.round(credits), day = new Date(timestamp).toISOString().slice(0, 10);
    const dayTotal = days.get(day) ?? emptyPeriod(); addPeriod(dayTotal, cost, seconds, roundedCredits); days.set(day, dayTotal);
    const productTotal = products.get(product) ?? emptyPeriod(); addPeriod(productTotal, cost, seconds, roundedCredits); products.set(product, productTotal);
    addPeriod(periods.thirtyDays, cost, seconds, roundedCredits);
    if (timestamp >= starts.sevenDays) addPeriod(periods.sevenDays, cost, seconds, roundedCredits);
    if (timestamp >= starts.today) addPeriod(periods.today, cost, seconds, roundedCredits);
  }
  const creditsUsed = count(account.character_count), creditsLimit = count(account.character_limit), overageRaw = record(account.current_overage).amount;
  const overageDollars = typeof overageRaw === "string" && overageRaw.trim() !== "" && Number.isFinite(Number(overageRaw)) ? Number(overageRaw) : null;
  const reset = unixSeconds(account.next_character_count_reset_unix);
  return {
    status: "available", measuredAt: new Date(now).toISOString(), ...periods,
    daily: [...days.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([dateValue, value]) => ({ date: dateValue, ...value })),
    products: [...products.entries()].map(([label, value]) => ({ label, ...value })).sort((a, b) => b.costMicrousd - a.costMicrousd),
    account: {
      tier: typeof account.tier === "string" ? account.tier.slice(0, 50) : null,
      creditsUsed, creditsLimit,
      creditsRemaining: creditsUsed !== null && creditsLimit !== null ? Math.max(0, creditsLimit - creditsUsed) : null,
      currentOverageMicrousd: overageDollars !== null ? microusd(overageDollars) : null,
      currency: typeof record(account.current_overage).currency === "string" ? String(record(account.current_overage).currency).slice(0, 8).toUpperCase() : null,
      resetsAt: reset !== null ? new Date(reset * 1000).toISOString() : null,
    },
  };
}

export interface UsageMember { id: string; display_name: string; email: string; role: string; status: string; available: number; reserved: number; events: number; input_tokens: number; output_tokens: number; cached_tokens: number; seconds: number; known_cost_microusd: number; unmeasured: number; partial_cost: number; last_used: string | null }
export interface UsagePage { members: UsageMember[]; total: number; nextOffset: number | null; rates: { id: string; label: string; credit_value_microusd: number; markup_bps: number; status: string }[]; paymentsReady: boolean; meteringMode: "observe"; provider: ProviderUsageSnapshot }
export interface ProfileData { name: string; email: string; role: string; avatarTone: string; business: string; timezone: string; goal: string; questions: string; completedAt: string | null }
