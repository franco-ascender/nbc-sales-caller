// DEMO fixtures only, for reviewing the Master Dashboard layout before any connection is
// real. Shapes mirror what GHL (appointments/pipeline) and Meta Ads (campaigns) will supply
// once tracker-ghl.service.ts / tracker-meta.service.ts are wired to a real UI. No client
// name, contact or number here is real — see docs/features/master-tracker.md.

export const DEMO_REVENUE_SERIES: number[] = [42, 48, 45, 60, 71, 52, 38, 40, 55, 68, 72, 58, 44, 30, 22, 26, 41, 55, 63, 70, 60, 48, 35, 30, 42, 50, 45, 30, 15, 5];

export const DEMO_CAMPAIGNS: { name: string; spendCents: number; calls: number; closingRate: number; showRate: number; revenueCents: number; sales: number }[] = [
  { name: 'SM - CreativeTesting - 09/02', spendCents: 640000, calls: 7, closingRate: 0.667, showRate: 0.429, revenueCents: 100000, sales: 1 },
  { name: 'SM - LegacyAds - exVec-A', spendCents: 220000, calls: 6, closingRate: 0, showRate: 0.167, revenueCents: 0, sales: 0 },
  { name: 'SM - Vids - exVecAwf - 09/01', spendCents: 580000, calls: 5, closingRate: 0, showRate: 0.4, revenueCents: 50000, sales: 1 },
  { name: '[MB] - PROS - Creative testing', spendCents: 0, calls: 2, closingRate: 0, showRate: 0, revenueCents: 0, sales: 0 },
  { name: 'Whop - 53% Chicago - 09/02', spendCents: 88370, calls: 6, closingRate: 0.75, showRate: 1, revenueCents: 0, sales: 2 },
];

export const DEMO_REPS: { name: string; totalCalls: number; showRate: number; showedCalls: number; offersMade: number; closingRate: number; closedCalls: number; revenueCents: number; aovCents: number }[] = [
  { name: 'Rep A', totalCalls: 93, showRate: 0.29, showedCalls: 27, offersMade: 17, closingRate: 0.259, closedCalls: 7, revenueCents: 6690000, aovCents: 960000 },
  { name: 'Rep B', totalCalls: 117, showRate: 0.12, showedCalls: 14, offersMade: 5, closingRate: 0.143, closedCalls: 2, revenueCents: 2800000, aovCents: 1400000 },
];

export const DEMO_LIVE_FEED: { name: string; email: string; status: string; when: string }[] = [
  { name: 'Contact 1', email: 'lead1@example.com', status: 'New', when: '1 hour ago' },
  { name: 'Contact 2', email: 'lead2@example.com', status: 'New', when: '2 hours ago' },
  { name: 'Contact 3', email: 'lead3@example.com', status: 'New', when: '2 hours ago' },
  { name: 'Contact 4', email: 'lead4@example.com', status: 'New', when: '3 hours ago' },
];

export const DEMO_FUNNEL: { label: string; value: number }[] = [
  { label: 'Impressions', value: 1164507 },
  { label: 'Clicks', value: 82749 },
  { label: 'Leads', value: 776 },
  { label: 'Calls', value: 575 },
  { label: 'Booked', value: 186 },
  { label: 'Showed', value: 110 },
  { label: 'Sales', value: 43 },
];

// Illustrative operating records only. These are intentionally anonymous so the completed
// product structure can be reviewed without representing a customer, deal or account as real.
export const DEMO_PIPELINE_STAGES = [
  { label: 'New opportunity', count: 51, valueCents: 9600000, accent: 'blue' },
  { label: 'Qualified', count: 32, valueCents: 7840000, accent: 'ink' },
  { label: 'Proposal sent', count: 18, valueCents: 5160000, accent: 'gold' },
  { label: 'Decision', count: 9, valueCents: 3320000, accent: 'blue' },
] as const;

export const DEMO_REVENUE_ACTIVITY = [
  { label: 'Payment recorded', account: 'Account A', amountCents: 1200000, when: 'Today · 10:42 AM' },
  { label: 'Opportunity moved to decision', account: 'Account B', amountCents: 680000, when: 'Today · 9:18 AM' },
  { label: 'Call booked', account: 'Account C', amountCents: null, when: 'Yesterday · 4:05 PM' },
  { label: 'Proposal sent', account: 'Account D', amountCents: 340000, when: 'Yesterday · 2:31 PM' },
] as const;

export const DEMO_JOURNEYS = [
  { account: 'Account A', source: 'Paid social', stage: 'Decision', valueCents: 1200000, owner: 'Rep A', signal: 'Follow up today', tone: 'attention' },
  { account: 'Account B', source: 'Referral', stage: 'Proposal sent', valueCents: 680000, owner: 'Rep B', signal: 'Proposal open', tone: 'steady' },
  { account: 'Account C', source: 'Organic', stage: 'Qualified', valueCents: 420000, owner: 'Rep A', signal: 'Call booked', tone: 'steady' },
  { account: 'Account D', source: 'Paid social', stage: 'New opportunity', valueCents: 220000, owner: 'Unassigned', signal: 'Needs owner', tone: 'attention' },
] as const;

export const DEMO_JOURNEY_EVENTS = [
  { label: 'Booked a discovery call', detail: 'Calendar event · Preview', when: 'Sep 27' },
  { label: 'Moved to qualified', detail: 'Pipeline event · Preview', when: 'Sep 28' },
  { label: 'Proposal sent', detail: 'CRM event · Preview', when: 'Sep 29' },
  { label: 'Follow-up due', detail: 'Owner action · Preview', when: 'Today' },
] as const;
