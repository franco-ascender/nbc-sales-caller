import { quoteJob } from './lead-engine-jobs.ts';
import { registerSourceFor } from './lead-engine-brain.ts';
import { parcelSourceFor } from './lead-engine-parcel.ts';
export const WORKFLOW_STATES = 'AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY'.split(' ');
export function inspectWorkflowRoutes(industry: string) {
  return Object.fromEntries(WORKFLOW_STATES.map(state => {
    try {
      const quote = quoteJob({ industry, state, targetCells: 5, useFallback: false });
      const fallback = quote.recipe !== quote.route.recipe;
      const mapped = registerSourceFor(quote.route.industry, state);
      const reason = quote.blockers.length ? 'blocked' : fallback
        ? quote.route.legalStatus === 'prohibited' ? 'source_restricted' : !mapped || quote.route.sources.length===0 ? 'register_missing' : 'legacy_requirements_missing'
        : quote.recipe === 'A' ? 'listings_configured' : 'register_configured';
      const explanation = reason==='blocked' ? 'The current quote is blocked. A required source or execution setting is missing, or the alternative is disallowed. See the exact quote blockers below.'
        : reason==='source_restricted' ? 'The recorded source restriction prevents using the register here. The current configuration falls back to business listings.'
        : reason==='register_missing' ? 'There is no fully mapped register route for this niche in this state. The current configuration falls back to business listings; a source mentioned in research is not a connected route.'
        : reason==='legacy_requirements_missing' ? 'A register is mapped, but the older identity-enrichment route lacks a required connection here. The current configuration falls back to business listings.'
        : reason==='listings_configured' ? 'Google Maps is the source currently connected for this niche: it finds businesses advertising the service and a public contact number. A working register alternative is not connected yet. We have not measured whether this is the best-performing approach.'
        : quote.recipe==='C' ? 'The connected register supplies phone numbers, so this route checks those numbers directly. It does not add a Maps comparison. We still need to check that the records are current and the numbers are published for business use.'
        : quote.recipe==='D' ? 'This route starts with phone records from the register, then checks the same businesses on Maps. That comparison shows whether the register adds a different contact or repeats the advertised number. It does not prove who owns the phone.'
        : 'The mapping selects an older identity-first route. It includes residential enrichment and has not been validated by this published-business-contact review.';
      return [state, { recipe: quote.recipe, source: quote.registerSource, blocked: quote.blockers.length > 0, fallback, legacy: quote.recipe === 'B', reason, explanation, blockers: quote.blockers,
        enrichmentSource:quote.recipe==='B' ? quote.parcelSource : null,
        enrichmentCounty:quote.recipe==='B' && !quote.skipParcel ? parcelSourceFor(state)?.county??null : null,
        registerAddressUsed:quote.recipe==='B' && quote.skipParcel }];
    } catch {
      return [state, { recipe: null, source: null, blocked: true, fallback: false, legacy: false, reason:'unavailable', explanation:'The existing quote could not resolve this route. No route is available to inspect.', blockers:[] }];
    }
  }));
}
