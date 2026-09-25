import assert from "node:assert/strict";
import test from "node:test";
import { candidateIsEligible, canPreparePurchase, chooseCityCoverage } from "../src/lib/caller-city-numbers.ts";
import { decimalPriceToCents, formatUsPhoneNumber, normalizeCitySearch, parseTwilioLocalCandidates, parseTwilioLocalPrice } from "../src/lib/twilio-phone-numbers.ts";

const boston = { id: "number-boston", phoneNumber: "+16175550100", locality: "Boston", region: "MA", rateCenter: "BOSTON", voice: true, addressRequirements: "none" as const, status: "active" as const };

test("city coverage selects an owned exact-city number before considering any new quote", () => {
  assert.deepEqual(chooseCityCoverage({ city: " Boston ", region: "MA", country: "US", qualifiedLeadCount: 200, hasPlannedCampaign: true }, [boston]), { action: "use_city_number", assignment: boston });
});

test("coverage only quotes an unserved city after a demand signal and never buys", () => {
  assert.deepEqual(chooseCityCoverage({ city: "Austin", region: "TX", country: "US", qualifiedLeadCount: 25, hasPlannedCampaign: false }, []), { action: "quote_city_number", reason: "lead_threshold" });
  assert.deepEqual(chooseCityCoverage({ city: "Austin", region: "TX", country: "US", qualifiedLeadCount: 2, hasPlannedCampaign: false }, []), { action: "manual_review", reason: "no_voice_candidate" });
});

test("purchasing remains impossible without Anas approval and eligible local numbers need voice with no address block", () => {
  assert.equal(canPreparePurchase(0, false), false);
  assert.equal(canPreparePurchase(10, true), false);
  assert.equal(canPreparePurchase(9, true), true);
  assert.equal(candidateIsEligible({ ...boston, addressRequirements: "local" }), false);
  assert.equal(candidateIsEligible({ ...boston, voice: false }), false);
  assert.equal(candidateIsEligible(boston), true);
});

test("Twilio locality input and account pricing are normalized without floating point money", () => {
  assert.deepEqual(normalizeCitySearch("  Miami Beach ", "fl"), { city: "Miami Beach", region: "FL" });
  assert.throws(() => normalizeCitySearch("Miami", "XX"));
  assert.equal(decimalPriceToCents("1.25"), 125);
  assert.equal(decimalPriceToCents("1.005"), 100);
  assert.deepEqual(parseTwilioLocalPrice({ price_unit: "usd", phone_number_prices: [{ number_type: "local", current_price: "1.15" }] }), { monthlyCents: 115, currency: "USD" });
});

test("Twilio candidates keep only structurally valid phone records and preserve eligibility fields", () => {
  const parsed = parseTwilioLocalCandidates({ available_phone_numbers: [
    { phone_number: "+13055550123", locality: "Miami", region: "FL", rate_center: "MIAMI", address_requirements: "none", capabilities: { voice: true } },
    { phone_number: "invalid", capabilities: { voice: true } },
  ] });
  assert.deepEqual(parsed, [{ phoneNumber: "+13055550123", locality: "Miami", region: "FL", rateCenter: "MIAMI", voice: true, addressRequirement: "none" }]);
  assert.equal(formatUsPhoneNumber("+13055550123"), "(305) 555-0123");
});
