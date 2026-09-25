import brandsFile from '../data/lead-engine-brands.json' with { type: 'json' };
import { franchiseBrand } from './lead-engine-industries.ts';

// Phase 1 task 2: the chain filter. A Maps listing whose title carries a chain or franchise brand is
// dropped before any paid call (brain recipe A, filter step "drop chains"). The tokens come from
// src/data/lead-engine-brands.json (OpenStreetMap name-suggestion-index for auto and food, the research
// franchise lists for the service trades); this module only decides which groups apply to an industry
// and matches whole-word phrases. The older hand list in lead-engine-industries.ts (franchiseBrand)
// stays as a second opinion so nothing it caught before is lost.

export type BrandGroup = 'auto' | 'food' | 'cleaning' | 'lawn_landscape' | 'junk_moving' | 'home_services' | 'fitness' | 'medspa_wellness' | 'education_childcare';
const GROUPS: readonly BrandGroup[] = ['auto', 'food', 'cleaning', 'lawn_landscape', 'junk_moving', 'home_services', 'fitness', 'medspa_wellness', 'education_childcare'];
const file = brandsFile as { groups: Record<string, string[]> };

export function normalizeBrandText(value: string): string {
  return value.normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/['’]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

const TRADES: readonly BrandGroup[] = ['home_services', 'cleaning', 'lawn_landscape', 'junk_moving'];
// Which brand groups can plausibly appear in a Maps search for the industry. Scoping by industry keeps a
// restaurant chain called "Alpine" from deleting Alpine Roofing, while still catching Roto-Rooter there.
export function chainGroupsFor(industryKey: string | null): readonly BrandGroup[] {
  const key = industryKey ?? '';
  if (/^(auto_|car_|exotic_car|tint|detailing|towing)/.test(key)) return ['auto'];
  if (/restaurant|cafe|food|bar$/.test(key)) return ['food'];
  if (/contractor|hvac|roofing|plumbing|electrical|remodeling|pool|landscaping|painting|fencing|concrete|pest|movers|junk|cleaning|handyman|tree|permits|licensee/.test(key)) return TRADES;
  if (/salon|barber|spa|healthcare|chiro|dentist|medspa|wellness|fitness|gym|studio/.test(key)) return ['medspa_wellness', 'fitness'];
  if (/childcare|daycare|tutor|school/.test(key)) return ['education_childcare'];
  return GROUPS;
}

// Whole-word phrase match of every token in the given groups. Without an industry every group applies
// but only distinctive tokens (two words or seven letters) count, so a bare surname never drops a row.
export function isChain(businessName: string, industryKey: string | null = null): string | null {
  const text = ` ${normalizeBrandText(businessName)} `;
  if (text.trim().length === 0) return null;
  const groups = industryKey === null ? GROUPS : chainGroupsFor(industryKey);
  const distinctiveOnly = industryKey === null;
  for (const group of groups) {
    for (const token of file.groups[group] ?? []) {
      if (distinctiveOnly && !token.includes(' ') && token.length < 7) continue;
      if (text.includes(` ${token} `)) return token;
    }
  }
  return franchiseBrand(businessName);
}

export function brandGroupCounts(): Record<string, number> {
  return Object.fromEntries(GROUPS.map(group => [group, (file.groups[group] ?? []).length]));
}
