export interface SearchRates {
  placeMicrousd: number; startMicrousd: number; minimumCapCents: number;
  readMicrousd: number; transferUsdPerGb: number; storageUsdPerGbHour: number; retentionHours: number; availableCents: number; activeRuns: number;
  verificationUnitCents: number; checkedAt: string;
}
export interface SearchQuote {
  token: string; expiresAt: string; checkedAt: string; count: number;
  discoveryEstimateCents: number; discoveryCapCents: number; dataAllowanceCents: number;
  verificationMaxCents: number; verificationUnitCents: number; estimatedTotalCents: number;
  maximumCents: number; availableCents: number; blockers: string[];
}
export function priceSearch(count: number, rates: SearchRates): Omit<SearchQuote, 'token'|'expiresAt'> {
  if (!Number.isSafeInteger(count) || count < 5 || count > 5000) throw Error('Choose 5–5,000 businesses.');
  for (const value of [rates.placeMicrousd,rates.startMicrousd,rates.minimumCapCents,rates.readMicrousd,rates.transferUsdPerGb,rates.storageUsdPerGbHour,rates.retentionHours,rates.availableCents]) if (!Number.isFinite(value)||value<0) throw Error('Current search pricing could not be confirmed.');
  if (rates.placeMicrousd <= 0 || !Number.isSafeInteger(rates.verificationUnitCents)||rates.verificationUnitCents<1||rates.verificationUnitCents>10) throw Error('Confirm the phone verification rate before quoting a complete list.');
  const discoveryEstimateCents = Math.ceil((rates.startMicrousd + count*rates.placeMicrousd)/10000);
  // The provider's minimum is a spending-cap minimum, not a minimum invoice.
  const discoveryCapCents = Math.max(rates.minimumCapCents, discoveryEstimateCents + Math.ceil(rates.placeMicrousd/10000));
  // Bounded result pages are <= 2 MiB per 200 rows. Include a retry/read margin;
  // actual storage/transfer usage remains separately reconciled, not called exact.
  const dataAllowanceCents = Math.max(1, Math.ceil((count*2*rates.readMicrousd/1e6 + Math.ceil(count/200)*4*1024*1024/1e9*rates.transferUsdPerGb + Math.ceil(count/200)*2*1024*1024/1e9*rates.storageUsdPerGbHour*rates.retentionHours)*100));
  const verificationMaxCents = count*rates.verificationUnitCents;
  const maximumCents = discoveryCapCents+dataAllowanceCents+verificationMaxCents;
  const blockers = rates.availableCents < discoveryCapCents+dataAllowanceCents ? [`The search account has $${(rates.availableCents/100).toFixed(2)} remaining under its monthly limit; this search needs $${((discoveryCapCents+dataAllowanceCents)/100).toFixed(2)} available.`] : [];
  if(rates.activeRuns>0)blockers.push('Another search is active in the connected account. Wait for it to finish.');
  return {count,checkedAt:rates.checkedAt,discoveryEstimateCents,discoveryCapCents,dataAllowanceCents,verificationMaxCents,verificationUnitCents:rates.verificationUnitCents,estimatedTotalCents:discoveryEstimateCents+dataAllowanceCents+verificationMaxCents,maximumCents,availableCents:rates.availableCents,blockers};
}
