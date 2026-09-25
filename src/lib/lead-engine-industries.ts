import { matchesPhrase, normalizeWords } from './lead-engine-plan.ts';

// Positive relevance allowlist (build spec §8): a row must positively match the trade by category,
// subcategory or name. A blocklist alone let a New York restaurant and a Vermont schooner charter
// reach a contractor list. `core` is the trade itself; `adjacent` is a neighbouring trade the same
// owner plausibly runs. Anything matching only a generic contractor word is tiered `general`.

export type FitTier = 'core' | 'adjacent' | 'general';
export interface IndustryProfile { key: string; aliases: readonly string[]; core: readonly string[]; adjacent: readonly string[] }

// Matching one of these alone never proves the trade, so it only ever produces the lowest tier.
// Deliberately excludes "services"/"company": those match a schooner charter as readily as a roofer.
const GENERIC_TERMS = ['contractor', 'contractors', 'contracting', 'construction', 'home improvement', 'home services'] as const;

const PROFILES: readonly IndustryProfile[] = [
  { key: 'roofing', aliases: ['roofing', 'roofer', 'roofers', 'roof'], core: ['roofing', 'roofer', 'roof repair', 'roofing contractor', 'roof'], adjacent: ['siding', 'gutter', 'gutters', 'exterior', 'storm damage', 'restoration'] },
  { key: 'hvac', aliases: ['hvac', 'air conditioning', 'heating', 'furnace', 'ac repair'], core: ['hvac', 'air conditioning', 'heating', 'furnace', 'heating contractor', 'air conditioning contractor', 'ac repair', 'cooling'], adjacent: ['plumbing', 'electrical', 'duct cleaning', 'indoor air quality', 'refrigeration'] },
  { key: 'plumbing', aliases: ['plumbing', 'plumber', 'plumbers'], core: ['plumbing', 'plumber', 'plumbing contractor', 'drain', 'rooter', 'sewer'], adjacent: ['hvac', 'water heater', 'septic', 'leak detection', 'excavation'] },
  { key: 'electrical', aliases: ['electrical', 'electrician', 'electricians'], core: ['electrical', 'electrician', 'electrical contractor', 'electric'], adjacent: ['generator', 'solar', 'lighting', 'low voltage', 'security system'] },
  { key: 'decks and patios', aliases: ['deck', 'decks', 'patio', 'patios', 'deck builder'], core: ['deck', 'decks', 'patio', 'patios', 'deck builder', 'screened porch', 'pergola'], adjacent: ['outdoor living', 'hardscape', 'fencing', 'sunroom', 'carpentry'] },
  { key: 'concrete', aliases: ['concrete', 'cement'], core: ['concrete', 'cement', 'concrete contractor', 'driveway', 'foundation', 'slab'], adjacent: ['masonry', 'paving', 'excavation', 'hardscape', 'asphalt'] },
  { key: 'pavers', aliases: ['paver', 'pavers', 'paving'], core: ['paver', 'pavers', 'paving', 'asphalt', 'driveway'], adjacent: ['concrete', 'hardscape', 'landscaping', 'sealcoating', 'masonry'] },
  { key: 'masonry', aliases: ['masonry', 'mason', 'brick', 'stonework'], core: ['masonry', 'mason', 'brick', 'stone', 'stonework', 'chimney'], adjacent: ['concrete', 'hardscape', 'retaining wall', 'fireplace', 'stucco'] },
  { key: 'fencing', aliases: ['fence', 'fences', 'fencing'], core: ['fence', 'fences', 'fencing', 'fence contractor'], adjacent: ['deck', 'gate', 'railing', 'landscaping', 'outdoor living'] },
  { key: 'landscaping', aliases: ['landscaping', 'landscaper', 'lawn care', 'lawn'], core: ['landscaping', 'landscaper', 'lawn care', 'lawn', 'landscape', 'grounds maintenance'], adjacent: ['hardscape', 'irrigation', 'tree', 'pest', 'snow removal'] },
  { key: 'hardscape', aliases: ['hardscape', 'hardscaping', 'retaining wall'], core: ['hardscape', 'hardscaping', 'retaining wall', 'outdoor living'], adjacent: ['landscaping', 'masonry', 'pavers', 'concrete', 'patio'] },
  { key: 'painting', aliases: ['painting', 'painter', 'painters'], core: ['painting', 'painter', 'painting contractor', 'house painter'], adjacent: ['drywall', 'pressure washing', 'cabinet refinishing', 'stucco', 'wallpaper'] },
  { key: 'flooring', aliases: ['flooring', 'floors', 'carpet', 'hardwood floor'], core: ['flooring', 'floors', 'floor', 'carpet', 'hardwood', 'tile', 'laminate', 'vinyl plank'], adjacent: ['remodeling', 'tile', 'refinishing', 'installation', 'countertop'] },
  { key: 'remodeling', aliases: ['remodeling', 'remodel', 'renovation', 'general contractor'], core: ['remodeling', 'remodel', 'renovation', 'renovations', 'general contractor', 'design build'], adjacent: ['kitchen', 'bathroom', 'addition', 'basement', 'carpentry'] },
  { key: 'kitchen and bath', aliases: ['kitchen', 'bath', 'bathroom', 'kitchen and bath', 'cabinet'], core: ['kitchen', 'bath', 'bathroom', 'cabinet', 'cabinets', 'countertop', 'countertops'], adjacent: ['remodeling', 'plumbing', 'tile', 'flooring', 'refacing'] },
  { key: 'windows and doors', aliases: ['window', 'windows', 'door', 'doors', 'windows and doors'], core: ['window', 'windows', 'door', 'doors', 'window replacement', 'glass'], adjacent: ['siding', 'sunroom', 'screen', 'shutters', 'exterior'] },
  { key: 'garage doors', aliases: ['garage door', 'garage doors', 'overhead door'], core: ['garage door', 'garage doors', 'overhead door'], adjacent: ['door', 'opener', 'gate', 'spring repair', 'automation'] },
  { key: 'gutters', aliases: ['gutter', 'gutters', 'gutter guard'], core: ['gutter', 'gutters', 'gutter guard', 'seamless gutter'], adjacent: ['roofing', 'siding', 'exterior', 'pressure washing', 'drainage'] },
  { key: 'siding', aliases: ['siding', 'exterior siding'], core: ['siding', 'siding contractor', 'vinyl siding', 'stucco'], adjacent: ['roofing', 'window', 'exterior', 'gutters', 'insulation'] },
  { key: 'restoration', aliases: ['restoration', 'water damage', 'fire damage', 'mold remediation'], core: ['restoration', 'water damage', 'fire damage', 'mold', 'remediation', 'mitigation'], adjacent: ['cleaning', 'roofing', 'plumbing', 'reconstruction', 'abatement'] },
  { key: 'pressure washing', aliases: ['pressure washing', 'power washing', 'soft wash'], core: ['pressure washing', 'power washing', 'soft wash', 'exterior cleaning'], adjacent: ['window cleaning', 'roof cleaning', 'painting', 'gutter', 'cleaning'] },
  { key: 'pool service', aliases: ['pool', 'pools', 'pool service', 'pool cleaning'], core: ['pool', 'pools', 'pool service', 'pool cleaning', 'pool maintenance'], adjacent: ['hot tub', 'pool construction', 'landscaping', 'deck', 'water feature'] },
  { key: 'handyman', aliases: ['handyman', 'handyman services'], core: ['handyman', 'handy man', 'home repair'], adjacent: ['remodeling', 'carpentry', 'painting', 'assembly', 'maintenance'] },
  { key: 'tree', aliases: ['tree', 'tree service', 'arborist', 'tree removal'], core: ['tree', 'tree service', 'arborist', 'tree removal', 'stump'], adjacent: ['landscaping', 'lawn', 'land clearing', 'storm cleanup', 'firewood'] },
  { key: 'pest', aliases: ['pest', 'pest control', 'exterminator'], core: ['pest', 'pest control', 'exterminator', 'termite', 'wildlife removal'], adjacent: ['mosquito', 'lawn', 'insulation', 'crawl space', 'sanitizing'] },
  { key: 'cleaning', aliases: ['cleaning', 'house cleaning', 'maid', 'janitorial'], core: ['cleaning', 'cleaner', 'maid', 'janitorial', 'housekeeping', 'carpet cleaning'], adjacent: ['pressure washing', 'window cleaning', 'restoration', 'disinfecting', 'organizing'] },
  { key: 'moving', aliases: ['moving', 'movers', 'moving company'], core: ['moving', 'movers', 'mover', 'relocation'], adjacent: ['storage', 'junk removal', 'packing', 'delivery', 'hauling'] },
  { key: 'junk removal', aliases: ['junk removal', 'junk', 'hauling', 'dumpster'], core: ['junk removal', 'junk', 'hauling', 'dumpster', 'debris removal'], adjacent: ['moving', 'demolition', 'cleanout', 'recycling', 'waste'] },
  { key: 'auto repair', aliases: ['auto repair', 'mechanic', 'auto shop', 'car repair'], core: ['auto repair', 'mechanic', 'automotive', 'car repair', 'transmission', 'brake'], adjacent: ['tire', 'oil change', 'body shop', 'detailing', 'inspection'] },
  { key: 'tint', aliases: ['tint', 'window tint', 'tinting'], core: ['tint', 'tinting', 'window tint', 'ppf', 'paint protection'], adjacent: ['detailing', 'wrap', 'audio', 'automotive', 'ceramic coating'] },
  { key: 'detailing', aliases: ['detailing', 'car detailing', 'auto detail'], core: ['detailing', 'detail', 'ceramic coating', 'paint correction'], adjacent: ['car wash', 'tint', 'wrap', 'auto repair'] },
  { key: 'auto body', aliases: ['auto body', 'body shop', 'collision'], core: ['auto body', 'body shop', 'collision repair', 'collision center', 'collision centre', 'collision service', 'collision'], adjacent: ['auto glass', 'auto repair', 'detailing', 'towing', 'automotive'] },
  { key: 'jewelers', aliases: ['jewelers', 'jeweler', 'jewelry', 'jewellery'], core: ['jeweler', 'jewelers', 'jewelry', 'jewellery'], adjacent: ['watch repair', 'appraisal', 'engraving', 'pawn', 'antiques'] },
  { key: 'exotic car dealers', aliases: ['exotic car dealers', 'exotic car dealer', 'exotic dealer', 'luxury car dealer', 'classic car dealer'], core: ['exotic car', 'exotic cars', 'exotic auto', 'exotic motors', 'luxury car', 'luxury cars', 'luxury auto', 'luxury motors', 'classic car', 'classic cars', 'classic auto', 'classic motors'], adjacent: ['car dealer', 'used cars', 'auto dealer', 'automotive'] },
  { key: 'towing', aliases: ['towing', 'tow truck', 'wrecker'], core: ['towing', 'tow', 'wrecker', 'roadside assistance'], adjacent: ['auto repair', 'recovery', 'junk car', 'transport', 'lockout'] },
  { key: 'salons', aliases: ['salon', 'salons', 'hair salon', 'hair'], core: ['salon', 'hair', 'hairdresser', 'stylist', 'beauty salon'], adjacent: ['barber', 'nails', 'spa', 'lashes', 'esthetician'] },
  { key: 'barbers', aliases: ['barber', 'barbers', 'barbershop'], core: ['barber', 'barbershop', 'barber shop'], adjacent: ['salon', 'hair', 'grooming', 'shave', 'mens grooming'] },
  { key: 'nails', aliases: ['nail', 'nails', 'nail salon'], core: ['nail', 'nails', 'nail salon', 'manicure', 'pedicure'], adjacent: ['salon', 'spa', 'lashes', 'waxing', 'beauty'] },
  { key: 'tattoo', aliases: ['tattoo', 'tattoos', 'tattoo shop'], core: ['tattoo', 'tattoos', 'tattoo studio', 'piercing'], adjacent: ['body art', 'permanent makeup', 'removal', 'studio', 'microblading'] },
  { key: 'gyms', aliases: ['gym', 'gyms', 'fitness', 'crossfit'], core: ['gym', 'fitness', 'crossfit', 'training', 'health club'], adjacent: ['yoga', 'pilates', 'martial arts', 'nutrition', 'recovery'] },
  { key: 'studios', aliases: ['studio', 'studios', 'yoga', 'pilates', 'dance studio'], core: ['studio', 'yoga', 'pilates', 'dance', 'barre', 'martial arts'], adjacent: ['fitness', 'gym', 'wellness', 'training', 'music'] },
  { key: 'daycares', aliases: ['daycare', 'day care', 'child care', 'preschool'], core: ['daycare', 'day care', 'child care', 'childcare', 'preschool', 'learning center'], adjacent: ['montessori', 'after school', 'early education', 'academy', 'tutoring'] },
];

const FRANCHISE_BRANDS: readonly string[] = [
  'roto rooter', 'mr rooter', 'benjamin franklin plumbing', 'one hour heating', 'aire serv', 'mr handyman', 'servpro', 'serv pro',
  'chem dry', 'stanley steemer', 'molly maid', 'merry maids', 'the maids', 'two men and a truck', 'college hunks', 'junk king',
  '1 800 got junk', 'got junk', 'terminix', 'orkin', 'trugreen', 'lawn doctor', 'weed man', 'jan pro', 'anytime fitness',
  'planet fitness', 'orangetheory', 'great clips', 'supercuts', 'sport clips', 'midas', 'meineke', 'jiffy lube', 'valvoline',
  'maaco', 'ziebart', 'precision garage door', 'window world', 'budget blinds', 'kitchen tune up', 'bath fitter', 're bath',
  'mosquito joe', 'christmas decor', 'paul davis', 'rainbow restoration', 'ace handyman', 'handyman connection', 'cutco',
  'five star bath', 'dryer vent wizard', 'true blue', 'pool scouts', 'american leak detection', 'mighty dog roofing',
];

export function findIndustryProfile(industry: string): IndustryProfile | null {
  const normalized = normalizeWords(industry);
  if (!normalized) return null;
  const matches = PROFILES.filter(profile => profile.aliases.some(alias => matchesPhrase(normalized, alias)));
  if (matches.length === 0) return null;
  // Longest alias wins so "garage door" does not resolve to the broader "door" profile.
  return matches.reduce((best, profile) => {
    const reach = (entry: IndustryProfile) => Math.max(...entry.aliases.filter(alias => matchesPhrase(normalized, alias)).map(alias => alias.length));
    return reach(profile) > reach(best) ? profile : best;
  });
}

// Returns null when nothing positively matches the trade — the caller rejects the row.
export function classifyRelevance(text: string, industry: string): FitTier | null {
  const profile = findIndustryProfile(industry);
  const hits = (terms: readonly string[]) => terms.some(term => matchesPhrase(text, term));
  if (profile) {
    if (profile.key === 'pest' && hits(['crop pest', 'crop protection', 'agricultural pest', 'agricultural spraying', 'farm pest'])
      && !hits(['structural pest', 'residential pest', 'termite', 'exterminator', 'home pest'])) return null;
    if (hits(profile.core)) return 'core';
    // These requests identify a narrow business cohort. Adjacent retail/automotive
    // categories are useful review hints but not paid-verification candidates.
    if (['detailing', 'auto body', 'jewelers', 'exotic car dealers'].includes(profile.key)) return null;
    if (hits(profile.adjacent)) return 'adjacent';
    return hits(GENERIC_TERMS) ? 'general' : null;
  }
  return matchesPhrase(text, industry) ? 'core' : null;
}

// Franchises stay on the list — the brand is a column, not a drop reason (master prompt, step 4).
export function franchiseBrand(businessName: string): string | null {
  const normalized = normalizeWords(businessName);
  const brand = FRANCHISE_BRANDS.find(entry => matchesPhrase(normalized, entry));
  return brand ?? null;
}

export const FIT_TIER_ORDER: Record<FitTier, number> = { core: 0, adjacent: 1, general: 2 };
