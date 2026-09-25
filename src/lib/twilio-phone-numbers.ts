import { isRecord } from "./integration-validation.ts";

export interface TwilioLocalCandidate {
  phoneNumber: string;
  locality: string | null;
  region: string | null;
  rateCenter: string | null;
  voice: boolean;
  addressRequirement: "none" | "any" | "local" | "unknown";
}

const US_REGIONS = new Set([
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY","DC",
]);

export function normalizeCitySearch(city: unknown, region: unknown): { city: string; region: string } {
  if (typeof city !== "string" || typeof region !== "string") throw new Error("Enter a city and state.");
  const cleanCity = city.trim().replace(/\s+/g, " ");
  const cleanRegion = region.trim().toUpperCase();
  if (!/^[A-Za-z][A-Za-z .'-]{1,79}$/.test(cleanCity) || !US_REGIONS.has(cleanRegion)) throw new Error("Enter a valid US city and two-letter state.");
  return { city: cleanCity, region: cleanRegion };
}

export function decimalPriceToCents(value: unknown): number | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const match = String(value).match(/^(\d{1,6})(?:\.(\d{1,4}))?$/);
  if (!match) return null;
  const cents = Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0").slice(0, 2));
  return Number.isSafeInteger(cents) ? cents : null;
}

export function parseTwilioLocalCandidates(payload: unknown): TwilioLocalCandidate[] {
  if (!isRecord(payload) || !Array.isArray(payload.available_phone_numbers)) return [];
  return payload.available_phone_numbers.flatMap((raw): TwilioLocalCandidate[] => {
    if (!isRecord(raw) || typeof raw.phone_number !== "string" || !/^\+[1-9]\d{7,14}$/.test(raw.phone_number)) return [];
    const capabilities = isRecord(raw.capabilities) ? raw.capabilities : {};
    const requirement = ["none", "any", "local"].includes(String(raw.address_requirements)) ? raw.address_requirements as "none" | "any" | "local" : "unknown";
    return [{
      phoneNumber: raw.phone_number,
      locality: typeof raw.locality === "string" ? raw.locality : null,
      region: typeof raw.region === "string" ? raw.region : null,
      rateCenter: typeof raw.rate_center === "string" ? raw.rate_center : null,
      voice: capabilities.voice === true,
      addressRequirement: requirement,
    }];
  });
}

export function parseTwilioLocalPrice(payload: unknown): { monthlyCents: number; currency: string } | null {
  if (!isRecord(payload) || !Array.isArray(payload.phone_number_prices)) return null;
  const local = payload.phone_number_prices.find(item => isRecord(item) && item.number_type === "local");
  if (!isRecord(local)) return null;
  const monthlyCents = decimalPriceToCents(local.current_price);
  const currency = typeof payload.price_unit === "string" ? payload.price_unit.toUpperCase() : "";
  return monthlyCents === null || !/^[A-Z]{3}$/.test(currency) ? null : { monthlyCents, currency };
}

export function formatUsPhoneNumber(value: string): string {
  const match = value.match(/^\+1(\d{3})(\d{3})(\d{4})$/);
  return match ? `(${match[1]}) ${match[2]}-${match[3]}` : value;
}
