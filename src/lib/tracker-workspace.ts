export const TRACKER_SECTION_IDS = ['business', 'acquisition', 'sales', 'signals'] as const;
export type TrackerSectionId = typeof TRACKER_SECTION_IDS[number];

export interface TrackerLayout {
  order: TrackerSectionId[];
  hidden: TrackerSectionId[];
}

export const DEFAULT_TRACKER_LAYOUT: TrackerLayout = {
  order: [...TRACKER_SECTION_IDS],
  hidden: [],
};

const isSectionId = (value: unknown): value is TrackerSectionId =>
  typeof value === 'string' && (TRACKER_SECTION_IDS as readonly string[]).includes(value);

const cloneDefault = (): TrackerLayout => ({ order: [...DEFAULT_TRACKER_LAYOUT.order], hidden: [] });

export function parseTrackerLayout(value: string | null): TrackerLayout {
  if (!value) return cloneDefault();
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object' || !('order' in parsed) || !('hidden' in parsed)) return cloneDefault();
    const { order, hidden } = parsed as { order: unknown; hidden: unknown };
    if (!Array.isArray(order) || !Array.isArray(hidden) || order.length !== TRACKER_SECTION_IDS.length) return cloneDefault();
    if (!order.every(isSectionId) || new Set(order).size !== TRACKER_SECTION_IDS.length) return cloneDefault();
    if (!hidden.every(isSectionId) || new Set(hidden).size !== hidden.length) return cloneDefault();
    return { order: [...order], hidden: [...hidden] };
  } catch {
    return cloneDefault();
  }
}

export function toggleTrackerSection(layout: TrackerLayout, section: TrackerSectionId): TrackerLayout {
  const hidden = layout.hidden.includes(section)
    ? layout.hidden.filter(item => item !== section)
    : [...layout.hidden, section];
  return { order: [...layout.order], hidden };
}

export function moveTrackerSection(layout: TrackerLayout, section: TrackerSectionId, direction: -1 | 1): TrackerLayout {
  const index = layout.order.indexOf(section);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= layout.order.length) return { order: [...layout.order], hidden: [...layout.hidden] };
  const order = [...layout.order];
  [order[index], order[target]] = [order[target], order[index]];
  return { order, hidden: [...layout.hidden] };
}
