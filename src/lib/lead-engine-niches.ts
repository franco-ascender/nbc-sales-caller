// Presentation taxonomy only. Existing job identifiers and routing stay unchanged.
export interface WorkflowNiche { id: string; title: string; rationale: string; variants: Record<string, string>; defaultReview: string; scope?: Record<string, string> }
const niche = (id: string, title: string, rationale: string, variants: Record<string,string> = {}, scope?: Record<string,string>): WorkflowNiche => ({id,title,rationale,defaultReview:id,variants,scope});
export const WORKFLOW_NICHES: WorkflowNiche[] = [
  niche('car_detailing','Car detailing','Look for detailing services such as ceramic coating and paint correction. A car wash alone does not establish a detailing business.'),
  niche('hvac','HVAC','Business listings identify local heating and cooling companies. A license can add identity evidence, but a statewide trade-specific source still needs to be connected.'),
  niche('roofing','Roofing','Start with roofing businesses. A general contractor license alone does not establish that the company installs roofs.'),
  niche('plumbing','Plumbing','Find businesses that explicitly offer plumbing. Permit and license records can corroborate the trade where the local source is available.'),
  niche('electrical','Electrical contractors','Identify electrical contracting businesses, then distinguish the company from an employee holding an individual electrician license.'),
  niche('remodeling','Remodeling','Look for renovation businesses. Local permits may support recent work, but permit coverage is limited to the issuing city.'),
  niche('pool','Pool services','Require swimming-pool installation or maintenance. A wellness spa is a different business and should be excluded.'),
  niche('landscaping','Landscaping','Find local landscape service businesses and distinguish operating companies from unrelated garden retailers.'),
  niche('painting','Painting contractors','Look for painting services. A published company phone is a starting point; owner identity still requires separate evidence.'),
  niche('fencing','Fence contractors','Find fence installation businesses. A generic construction registration cannot establish the trade without additional evidence.'),
  niche('concrete','Concrete contractors','Identify concrete work explicitly. General construction companies should not be treated as concrete specialists by default.'),
  niche('auto_repair','Auto repair','Find operating repair shops. Where a state-specific identity source exists, inspect its coverage separately from the published shop phone.',{NY:'auto_repair_ny'}),
  niche('auto_body','Collision & auto body repair','Include collision and body repair. Mechanical repair alone does not establish a body shop.'),
  niche('jewelers','Jewelers','Require a jewelry business. Pawn shops and watch-only businesses should not silently expand this niche.'),
  niche('exotic_car_dealers','Exotic & luxury car dealers','Require explicit exotic, luxury or classic car inventory. A generic used-car dealer is not enough.'),
  niche('cpa','Accounting firms','A professional register can identify a CPA. That person still needs to be linked to the firm and to a published business contact.'),
  niche('realtor','Real estate agents','Real estate licenses can identify a person and brokerage. Being licensed does not by itself establish ownership or a direct business phone.'),
  niche('property_manager','Property management','Distinguish property managers from other real estate licensees. A brokerage license is not proof that the person manages properties.'),
  niche('dentist','Dental practices','Separate the practice, its clinicians and its owner. A clinician name or reception number alone does not identify the owner’s direct business contact.'),
  niche('chiropractor','Chiropractic practices','Match the practice to its clinicians, then establish the owner separately. A provider-directory contact may belong to reception.'),
  niche('med_spa','Med spas','Start with an actual med-spa business. Match its clinicians and company records: the medical director and the business owner can be different people.'),
  niche('attorney','Law firms','A lawyer register identifies a professional; a firm match is still needed. The current rules prohibit using Maps phone results as the final contact list.',{NY:'attorney_ny'}),
  niche('real_estate_investor','Real estate investors','An investor may have no storefront. Business identity and a contact explicitly published for business use need separate supporting sources.'),
  niche('developer','Property developers','A development company may not operate a public storefront. Identify the business and its role before looking for a published business contact.'),
  {...niche('contractors','Contractors','Use the contractor source available in the selected state. Some states publish contact numbers; permit sources may cover only one city.',{FL:'contractor_fl',MN:'contractor_mn',TX:'contractor_permits'},{TX:'Austin permit records only. This is not statewide Texas coverage.'}),defaultReview:'contractor_registry'},
  niche('movers_tree_haulers','Moving & hauling','Carrier records can identify transport businesses. A carrier registration does not establish that it is a moving company or that the listed officer is its owner.'),
  niche('pest_control','Pest control','Require structural or residential pest services. Agricultural crop treatment alone belongs to a different market.'),
  {...niche('salons_barbers','Salons & barbershops','Establishment licenses help identify the shop. Distinguish the business owner from an employee’s personal professional license.',{NY:'salon_barber_ny',FL:'barbershop_fl'},{FL:'The mapped Florida source covers barbershops, not every salon.'}),defaultReview:'salon_barber_ny'},
  {...niche('salon_suites','Salon suites','Suite tenants operate distinct businesses inside a shared location. The building’s main phone is not automatically a tenant’s contact.',{}, {TX:'Texas mini-establishment research exists, but its source is not connected to the runner.'}),defaultReview:'salon_suite_tx'},
  niche('childcare_home','Home-based childcare','A provider license may identify the operator. Do not substitute an administrator for an unresolved owner or use restricted residential information.'),
  niche('childcare_center','Childcare centers','The center, director and owner may be different. Confirm the operating business and owner separately before labeling a contact.'),
  {...niche('insurance_agencies','Insurance agencies','Distinguish the agency, its owner and its licensed agents. Florida and Texas expose different fields, so they cannot share an assumed phone source.',{FL:'insurance_agent_fl',TX:'insurance_agent_tx'}),defaultReview:'insurance_agent_tx'},
  niche('tax_preparer','Tax preparers','A preparer directory can include a business phone. Registration alone does not establish that the person owns the practice.'),
  {...niche('restaurants','Restaurants','Use a source that identifies the restaurant operator. A permit holder is a candidate, not automatic proof of restaurant ownership.',{}, {TX:'The mapped Texas source is liquor licenses. Restaurants without one are not covered.',NY:'The mapped New York food-inspection source has its own local scope; it is not a complete statewide restaurant list.'}),defaultReview:'restaurant_tx'},
  niche('str_operator','Short-term rental operators','Distinguish a rental owner from a manager or permit contact. Permit status and a published business contact need separate checks.',{}, {LA:'New Orleans permit records only. Not statewide Louisiana coverage.',FL:'Orlando permit records only. Not statewide Florida coverage.'}),
];
export const CROSS_NICHE_REVIEWS = ['pa_licensee','healthcare_ao_contrast'];
export function nicheReview(niche: WorkflowNiche, state: string): string { return niche.variants[state] ?? niche.defaultReview; }
export function nicheReviewIds(niche: WorkflowNiche): string[] { return [...new Set([niche.defaultReview,...Object.values(niche.variants)])]; }
export const METHOD_NAMES: Record<string,string> = {A:'Find businesses, then check their phones',B:'Start with licensed people, then resolve the contact',C:'Check phones already in the register',D:'Compare register phones with business listings'};
const STATE_NAMES:Record<string,string> = {AL:'Alabama',AK:'Alaska',AZ:'Arizona',AR:'Arkansas',CA:'California',CO:'Colorado',CT:'Connecticut',DE:'Delaware',DC:'District of Columbia',FL:'Florida',GA:'Georgia',HI:'Hawaii',ID:'Idaho',IL:'Illinois',IN:'Indiana',IA:'Iowa',KS:'Kansas',KY:'Kentucky',LA:'Louisiana',ME:'Maine',MD:'Maryland',MA:'Massachusetts',MI:'Michigan',MN:'Minnesota',MS:'Mississippi',MO:'Missouri',MT:'Montana',NE:'Nebraska',NV:'Nevada',NH:'New Hampshire',NJ:'New Jersey',NM:'New Mexico',NY:'New York',NC:'North Carolina',ND:'North Dakota',OH:'Ohio',OK:'Oklahoma',OR:'Oregon',PA:'Pennsylvania',RI:'Rhode Island',SC:'South Carolina',SD:'South Dakota',TN:'Tennessee',TX:'Texas',UT:'Utah',VT:'Vermont',VA:'Virginia',WA:'Washington',WV:'West Virginia',WI:'Wisconsin',WY:'Wyoming'};
export const stateName = (code:string):string => STATE_NAMES[code] ?? code;
export const STATE_CODES = 'AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY'.split(' ');
export interface EffectiveWorkflowRoute { recipe:string|null; source:string|null; blocked:boolean; fallback:boolean; legacy:boolean; reason?:string; blockers?:string[]; explanation?:string; enrichmentSource?:string|null; enrichmentCounty?:string|null; registerAddressUsed?:boolean }
export function stateRouteStatus(route?:EffectiveWorkflowRoute):string {
  if(!route)return 'Route not inspected';
  if(route.blocked)return 'Blocked · see missing requirements';
  if(route.legacy)return 'Existing path · not validated';
  if(route.fallback)return 'Business-listing fallback';
  return route.recipe==='A'?'Business listings configured':'Register route configured';
}
export function matchingStates(search:string):string[] {
  const query=search.trim().toLowerCase();
  const code=query.replaceAll('.','').toUpperCase();
  if(STATE_CODES.includes(code))return [code];
  return STATE_CODES.filter(code=>code.toLowerCase()===query||stateName(code).toLowerCase().includes(query));
}
export interface RouteStep { title:string; body:string; stop:string }
export function methodComparison(code:string, route?:EffectiveWorkflowRoute):string {
  if(!route?.recipe)return 'No route resolved for this state. Availability is not assumed.';
  if(code===route.recipe)return route.blocked ? 'The configuration selects this method, but the quote is blocked. It cannot run here yet.' : route.explanation ?? 'Selected by the current configuration.';
  if(code==='B')return 'This review does not recommend the legacy residential-enrichment route as a replacement for published business contacts.';
  if(code==='A')return route.blocked ? 'The current quote does not permit or cannot complete this alternative. See its recorded blockers above.' : 'The current mapping starts from identity or register records rather than listing discovery. A listing alone would not supply the same identity evidence.';
  if(route.recipe==='A')return 'No register-phone workflow is active for this niche and state. A research source must be connected and its fields checked before this method can replace listings.';
  if(route.recipe==='B')return 'An identity-source mapping is not enough: a usable business-phone source must be established. This register-phone method is not connected for the current route.';
  if(code==='C')return 'Using the register alone would omit the business-listing comparison that this state’s current configuration includes.';
  return 'The current route uses the register’s phone field directly. The additional listing comparison has not been enabled for this variant; no measured uplift is established.';
}
export function routeSteps(route: EffectiveWorkflowRoute): RouteStep[] {
  if(route.blocked) return [{title:'This state cannot run this route',body:route.explanation ?? 'The current route has an unmet requirement.',stop:'No collection starts from this inspector. The missing route must be resolved before a run.'}];
  if(route.legacy) return [{title:'The configured route starts with identity records',body:'This older route includes residential enrichment. It was not validated by the published-business-contact review.',stop:'A replacement using explicitly published business contacts is still needed. This screen does not certify or activate the legacy route.'}];
  const first: RouteStep = route.recipe==='A'
    ? {title:'Find businesses in the niche',body:'Search published business listings in the selected area.',stop:'Exclude listings that do not match the requested service.'}
    : {title:'Start with the selected register',body:'Read the business or professional records from the mapped source. A source mapping does not prove fresh records have been imported.',stop:'Exclude records outside the source’s geographic or license scope.'};
  const second: RouteStep = route.recipe==='D'
    ? {title:'Compare the register with business listings',body:'Match the same business, then compare its phone numbers. A different number is a candidate, not proof of a direct owner line.',stop:'Do not assume unmatched records or different numbers belong to the owner.'}
    : {title:'Keep a published business phone',body:route.recipe==='C'?'Use the phone supplied by the selected register. Check that it is published for business use.':'Use the number advertised by the business. This may be a shared reception line.',stop:'No number means no phone to verify. Missing evidence must remain visible.'};
  return [first,second,{title:'Check the number before delivery',body:'The existing runner checks phone type and calling restrictions, and applies its duplicate and exclusion rules. These checks require a separately authorized run.',stop:'A valid mobile number does not prove that the owner will answer.'},{title:'Keep owner proof separate',body:'Record what the source actually supports. Independent owner-to-business-contact proof is still not enforced across all reviewed routes.',stop:'Do not present a business-contact candidate as a confirmed owner contact.'}];
}
