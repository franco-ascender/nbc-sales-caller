import "server-only";
import { database, IntegrationError } from "./integration.service";
import { candidateIsEligible } from "@/lib/caller-city-numbers";
import { normalizeCitySearch, parseTwilioLocalCandidates, parseTwilioLocalPrice } from "@/lib/twilio-phone-numbers";
import { isRecord } from "@/lib/integration-validation";

export type PhoneNumberStatus = "quoted" | "purchasing" | "active" | "uncertain" | "expired" | "failed" | "retired" | "rejected";
export interface PhoneNumberCoverage {
  id: string; city: string; region: string; rateCenter: string | null; phoneNumber: string; voiceCapable: boolean;
  addressRequirement: "none" | "any" | "local" | "unknown"; quotedMonthlyCents: number | null; quotedCurrency: string;
  quoteExpiresAt: string | null; status: PhoneNumberStatus; purchasedAt: string | null;
}
export interface CityNumberCoverageSummary {
  configured: boolean; providerConfigured: boolean; canApprove: boolean;
  approval: { approved: boolean; maximumActiveNumbers: number; qualifiedLeadThreshold: number; monthlyBudgetCents: number | null; committedMonthlyCents: number } | null;
  numbers: PhoneNumberCoverage[];
}
export interface NumberQuoteResult { expiresAt: string; monthlyCents: number; currency: string; candidates: PhoneNumberCoverage[] }
class TwilioNumberError extends IntegrationError { constructor(status: number, message: string, readonly outcomeUncertain: boolean) { super(status, message); } }

const requirements = ["none", "any", "local", "unknown"] as const;
const statuses = ["quoted", "purchasing", "active", "uncertain", "expired", "failed", "retired", "rejected"] as const;
const isRequirement = (value: unknown): value is PhoneNumberCoverage["addressRequirement"] => typeof value === "string" && (requirements as readonly string[]).includes(value);
const isStatus = (value: unknown): value is PhoneNumberStatus => typeof value === "string" && (statuses as readonly string[]).includes(value);
const numberColumns = "id,city,region,rate_center,phone_number,voice_capable,address_requirement,quoted_monthly_cents,quoted_currency,quote_expires_at,status,purchased_at";

function row(value: Record<string, unknown>): PhoneNumberCoverage | null {
  if (typeof value.id !== "string" || typeof value.city !== "string" || typeof value.region !== "string" || typeof value.phone_number !== "string" || typeof value.voice_capable !== "boolean" || !isRequirement(value.address_requirement) || !isStatus(value.status)) return null;
  return {
    id: value.id, city: value.city, region: value.region, rateCenter: typeof value.rate_center === "string" ? value.rate_center : null,
    phoneNumber: value.phone_number, voiceCapable: value.voice_capable, addressRequirement: value.address_requirement,
    quotedMonthlyCents: typeof value.quoted_monthly_cents === "number" ? value.quoted_monthly_cents : null,
    quotedCurrency: typeof value.quoted_currency === "string" ? value.quoted_currency : "USD",
    quoteExpiresAt: typeof value.quote_expires_at === "string" ? value.quote_expires_at : null,
    status: value.status, purchasedAt: typeof value.purchased_at === "string" ? value.purchased_at : null,
  };
}

function twilioConfig(): { accountSid: string; authorization: string } {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim() ?? "";
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim() ?? "";
  if (!/^AC[0-9a-f]{32}$/i.test(accountSid) || !authToken) throw new IntegrationError(503, "Twilio number purchasing has not been connected yet.");
  return { accountSid, authorization: "Basic " + Buffer.from(accountSid + ":" + authToken).toString("base64") };
}

async function twilioJson(url: URL, init?: RequestInit): Promise<unknown> {
  const config = twilioConfig();
  let response: Response;
  try {
    response = await fetch(url, { ...init, headers: { Authorization: config.authorization, Accept: "application/json", ...init?.headers }, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(15000) });
  } catch { throw new TwilioNumberError(502, "Twilio could not be reached. No purchase was retried.", true); }
  let payload: unknown = null;
  try { payload = await response.json(); } catch { /* Provider errors may not contain JSON. */ }
  if (!response.ok) {
    console.error("Twilio number request failed", { status: response.status, requestId: response.headers.get("twilio-request-id") });
    throw new TwilioNumberError(response.status >= 400 && response.status < 500 ? 409 : 502, response.status >= 400 && response.status < 500 ? "Twilio could not complete that number request. Refresh availability and try another number." : "Twilio could not confirm the request. Reconcile it before trying again.", response.status >= 500);
  }
  return payload;
}

async function providerQuotes(city: string, region: string): Promise<{ monthlyCents: number; currency: string; candidates: ReturnType<typeof parseTwilioLocalCandidates> }> {
  const config = twilioConfig();
  const available = new URL("https://api.twilio.com/2010-04-01/Accounts/" + config.accountSid + "/AvailablePhoneNumbers/US/Local.json");
  available.searchParams.set("InLocality", city); available.searchParams.set("InRegion", region); available.searchParams.set("VoiceEnabled", "true");
  available.searchParams.set("ExcludeAllAddressRequired", "true"); available.searchParams.set("PageSize", "8");
  const pricing = new URL("https://pricing.twilio.com/v1/PhoneNumbers/Countries/US");
  const [availablePayload, pricingPayload] = await Promise.all([twilioJson(available), twilioJson(pricing)]);
  const price = parseTwilioLocalPrice(pricingPayload);
  if (!price) throw new IntegrationError(502, "Twilio did not return a usable local-number price.");
  return { ...price, candidates: parseTwilioLocalCandidates(availablePayload).slice(0, 8) };
}

export async function readCityNumberCoverage(canApprove = false): Promise<CityNumberCoverageSummary> {
  const db = database();
  const [policy, inventory] = await Promise.all([
    db.from("caller_phone_number_policy").select("anas_approved_budget,maximum_active_numbers,qualified_lead_threshold,monthly_budget_cents").eq("id", true).maybeSingle(),
    db.from("caller_phone_numbers").select(numberColumns).order("region").order("city"),
  ]);
  const missing = [policy.error, inventory.error].some(error => error?.code === "42P01" || error?.code === "PGRST205" || error?.code === "42703");
  if (missing) return { configured: false, providerConfigured: Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN), canApprove, approval: null, numbers: [] };
  if (policy.error || inventory.error || !policy.data || !Array.isArray(inventory.data)) throw new IntegrationError(503, "Local-number coverage could not be read. Try again shortly.");
  const p = policy.data;
  if (typeof p.anas_approved_budget !== "boolean" || typeof p.maximum_active_numbers !== "number" || typeof p.qualified_lead_threshold !== "number") throw new IntegrationError(503, "Local-number coverage settings are invalid.");
  const numbers = inventory.data.map(row).filter((item): item is PhoneNumberCoverage => item !== null);
  const committedMonthlyCents = numbers.filter(item => ["active", "purchasing", "uncertain"].includes(item.status)).reduce((sum, item) => sum + (item.quotedMonthlyCents ?? 0), 0);
  return { configured: true, providerConfigured: Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN), canApprove, approval: { approved: p.anas_approved_budget, maximumActiveNumbers: p.maximum_active_numbers, qualifiedLeadThreshold: p.qualified_lead_threshold, monthlyBudgetCents: typeof p.monthly_budget_cents === "number" ? p.monthly_budget_cents : null, committedMonthlyCents }, numbers };
}

export async function quoteCityNumbers(cityInput: unknown, regionInput: unknown): Promise<NumberQuoteResult> {
  let location: { city: string; region: string };
  try { location = normalizeCitySearch(cityInput, regionInput); } catch (error) { throw new IntegrationError(400, error instanceof Error ? error.message : "Enter a valid city and state."); }
  const quote = await providerQuotes(location.city, location.region);
  const eligible = quote.candidates.filter(candidate => candidateIsEligible({ phoneNumber: candidate.phoneNumber, locality: candidate.locality, region: candidate.region, rateCenter: candidate.rateCenter, voice: candidate.voice, addressRequirements: candidate.addressRequirement }));
  const expiresAt = new Date(Date.now() + 10 * 60_000).toISOString();
  if (!eligible.length) return { expiresAt, monthlyCents: quote.monthlyCents, currency: quote.currency, candidates: [] };
  const db = database(), phones = eligible.map(candidate => candidate.phoneNumber);
  const existing = await db.from("caller_phone_numbers").select("phone_number,status").in("phone_number", phones);
  if (existing.error) throw new IntegrationError(503, "The quote could not be saved. No number was purchased.");
  const locked = new Set((existing.data ?? []).filter(item => ["active", "purchasing", "uncertain"].includes(item.status)).map(item => item.phone_number));
  const values = eligible.filter(candidate => !locked.has(candidate.phoneNumber)).map(candidate => ({
    country: "US", city: location.city, region: location.region, rate_center: candidate.rateCenter, phone_number: candidate.phoneNumber,
    voice_capable: candidate.voice, address_requirement: candidate.addressRequirement, quoted_monthly_cents: quote.monthlyCents,
    quoted_currency: quote.currency, quote_expires_at: expiresAt, status: "quoted", purchase_request_id: null, purchase_error: null,
  }));
  if (!values.length) throw new IntegrationError(409, "The available numbers are already being handled. Refresh the inventory.");
  const saved = await db.from("caller_phone_numbers").upsert(values, { onConflict: "phone_number" }).select(numberColumns);
  if (saved.error || !Array.isArray(saved.data)) throw new IntegrationError(503, "The quote could not be saved. No number was purchased.");
  return { expiresAt, monthlyCents: quote.monthlyCents, currency: quote.currency, candidates: saved.data.map(row).filter((item): item is PhoneNumberCoverage => item !== null) };
}

export async function setNumberPurchasePolicy(actorId: string, approved: boolean, monthlyBudgetCents: unknown, maximumActiveNumbers: unknown): Promise<void> {
  const budget = Number(monthlyBudgetCents), maximum = Number(maximumActiveNumbers);
  if (approved && (!Number.isSafeInteger(budget) || budget < 100 || budget > 100_000)) throw new IntegrationError(400, "Choose a monthly number budget between $1 and $1,000.");
  if (!Number.isSafeInteger(maximum) || maximum < 1 || maximum > 100) throw new IntegrationError(400, "Choose a capacity between 1 and 100 numbers.");
  const update = approved ? { anas_approved_budget: true, approved_by: actorId, approved_at: new Date().toISOString(), monthly_budget_cents: budget, maximum_active_numbers: maximum } : { anas_approved_budget: false, approved_by: null, approved_at: null, monthly_budget_cents: null, maximum_active_numbers: maximum };
  const result = await database().from("caller_phone_number_policy").update(update).eq("id", true);
  if (result.error) throw new IntegrationError(503, "The purchase budget could not be updated.");
}

async function ownedTwilioNumber(phoneNumber: string): Promise<{ sid: string; phoneNumber: string } | null> {
  const config = twilioConfig();
  const url = new URL("https://api.twilio.com/2010-04-01/Accounts/" + config.accountSid + "/IncomingPhoneNumbers.json");
  url.searchParams.set("PhoneNumber", phoneNumber); url.searchParams.set("PageSize", "20");
  const payload = await twilioJson(url);
  if (!isRecord(payload) || !Array.isArray(payload.incoming_phone_numbers)) return null;
  const found = payload.incoming_phone_numbers.find(item => isRecord(item) && item.phone_number === phoneNumber && typeof item.sid === "string");
  return isRecord(found) ? { sid: String(found.sid), phoneNumber: String(found.phone_number) } : null;
}

async function activatePurchasedNumber(id: string, requestId: string, provider: { sid: string; phoneNumber: string }): Promise<PhoneNumberCoverage> {
  const result = await database().from("caller_phone_numbers").update({ status: "active", twilio_sid: provider.sid, purchased_at: new Date().toISOString(), purchase_error: null }).eq("id", id).eq("purchase_request_id", requestId).eq("phone_number", provider.phoneNumber).select(numberColumns).single();
  const parsed = result.data && row(result.data);
  if (result.error || !parsed) throw new IntegrationError(503, "Twilio owns the number, but NBC could not finish recording it. Use Reconcile before another purchase.");
  return parsed;
}

export async function reconcilePhoneNumber(id: string): Promise<PhoneNumberCoverage> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new IntegrationError(400, "Choose a valid number record.");
  const db = database();
  const current = await db.from("caller_phone_numbers").select(numberColumns + ",purchase_request_id").eq("id", id).maybeSingle();
  const raw: unknown = current.data;
  const parsed = isRecord(raw) ? row(raw) : null;
  const purchaseRequestId = isRecord(raw) && typeof raw.purchase_request_id === "string" ? raw.purchase_request_id : null;
  if (current.error || !parsed || !purchaseRequestId) throw new IntegrationError(404, "That number request was not found.");
  if (parsed.status === "active") return parsed;
  if (!["purchasing", "uncertain"].includes(parsed.status)) throw new IntegrationError(409, "That number is not awaiting reconciliation.");
  const owned = await ownedTwilioNumber(parsed.phoneNumber);
  if (!owned) throw new IntegrationError(409, "Twilio does not show this number in the account yet. No second purchase was attempted.");
  return activatePurchasedNumber(parsed.id, purchaseRequestId, owned);
}

export async function purchaseQuotedNumber(actorId: string, quoteId: unknown, requestId: unknown, confirmed: unknown): Promise<PhoneNumberCoverage> {
  if (confirmed !== true || typeof quoteId !== "string" || typeof requestId !== "string" || !/^[0-9a-f-]{36}$/i.test(quoteId) || !/^[0-9a-f-]{36}$/i.test(requestId)) throw new IntegrationError(400, "Confirm a valid number purchase.");
  const claim = await database().rpc("caller_claim_phone_number_purchase", { p_actor: actorId, p_quote: quoteId, p_request: requestId });
  if (claim.error) {
    const message = claim.error.message;
    if (message.includes("budget_not_approved")) throw new IntegrationError(409, "Anas must approve a monthly number budget first.");
    if (message.includes("quote_expired")) throw new IntegrationError(409, "This quote expired. Search again before purchasing.");
    if (message.includes("number_budget_exceeded")) throw new IntegrationError(409, "This purchase would exceed the approved monthly budget.");
    if (message.includes("number_capacity_reached")) throw new IntegrationError(409, "The approved number capacity has been reached.");
    if (message.includes("city_already_covered")) throw new IntegrationError(409, "This city already has an active local number.");
    throw new IntegrationError(409, "The number could not be reserved for purchase. Refresh its quote.");
  }
  if (!isRecord(claim.data) || !isRecord(claim.data.number)) throw new IntegrationError(503, "The number purchase could not be reserved.");
  const number = row(claim.data.number);
  if (!number) throw new IntegrationError(503, "The number purchase record is invalid.");
  if (number.status === "active") return number;
  if (claim.data.claimed !== true) return reconcilePhoneNumber(number.id);

  const config = twilioConfig();
  const url = new URL("https://api.twilio.com/2010-04-01/Accounts/" + config.accountSid + "/IncomingPhoneNumbers.json");
  const form = new URLSearchParams({ PhoneNumber: number.phoneNumber, FriendlyName: "NBC " + number.city + ", " + number.region });
  try {
    const payload = await twilioJson(url, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: form });
    if (!isRecord(payload) || typeof payload.sid !== "string" || payload.phone_number !== number.phoneNumber) throw new TwilioNumberError(502, "Twilio returned an incomplete purchase result. Reconcile it before trying again.", true);
    return activatePurchasedNumber(number.id, requestId, { sid: payload.sid, phoneNumber: number.phoneNumber });
  } catch (error) {
    if (error instanceof TwilioNumberError && !error.outcomeUncertain) {
      await database().from("caller_phone_numbers").update({ status: "failed", purchase_error: "Twilio rejected the purchase." }).eq("id", number.id).eq("purchase_request_id", requestId).eq("status", "purchasing");
      throw error;
    }
    let owned: Awaited<ReturnType<typeof ownedTwilioNumber>> = null;
    try { owned = await ownedTwilioNumber(number.phoneNumber); } catch { /* Preserve uncertainty. */ }
    if (owned) return activatePurchasedNumber(number.id, requestId, owned);
    await database().from("caller_phone_numbers").update({ status: "uncertain", purchase_error: "Provider outcome requires reconciliation." }).eq("id", number.id).eq("purchase_request_id", requestId).eq("status", "purchasing");
    throw error;
  }
}
