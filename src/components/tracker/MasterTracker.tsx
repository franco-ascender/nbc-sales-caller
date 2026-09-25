'use client';

import { useEffect, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  CalendarDays,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  CircleDashed,
  CircleDollarSign,
  Clock3,
  Database,
  Eye,
  EyeOff,
  Filter,
  Gauge,
  GitBranch,
  ListFilter,
  Layers3,
  Link2,
  MoreHorizontal,
  PhoneCall,
  PlayCircle,
  ReceiptText,
  Search,
  Settings2,
  Sparkles,
  Target,
  TrendingUp,
  UsersRound,
  X,
} from 'lucide-react';
import { DEMO_CAMPAIGNS, DEMO_FUNNEL, DEMO_JOURNEY_EVENTS, DEMO_JOURNEYS, DEMO_PIPELINE_STAGES, DEMO_REPS, DEMO_REVENUE_ACTIVITY, DEMO_REVENUE_SERIES } from '@/lib/tracker-demo';
import { compact, money, pct, smoothPath } from '@/lib/tracker-charts';
import {
  DEFAULT_TRACKER_LAYOUT,
  moveTrackerSection,
  parseTrackerLayout,
  toggleTrackerSection,
  type TrackerLayout,
  type TrackerSectionId,
} from '@/lib/tracker-workspace';
import styles from './MasterTracker.module.css';

const TABS = ['Overview', 'Revenue & pipeline', 'Sales quality', 'Acquisition', 'Funnel', 'Accounts & journeys', 'Data sources'] as const;
type Tab = typeof TABS[number];

const SECTION_COPY: Record<TrackerSectionId, { title: string; description: string }> = {
  business: { title: 'Business pulse', description: 'Calls, booked conversations and the current operating picture.' },
  acquisition: { title: 'Acquisition', description: 'Campaign context beside the downstream conversion signal.' },
  sales: { title: 'Sales performance', description: 'What the closer view will make comparable.' },
  signals: { title: 'Quality signals', description: 'Objections and source coverage, without inventing insight.' },
};

const LAYOUT_KEY = 'nbc-tracker-layout-v1';

export function MasterTracker() {
  const [tab, setTab] = useState<Tab>('Overview');
  const [customizing, setCustomizing] = useState(false);
  const [range, setRange] = useState('Sep 1 – Sep 30, 2026');
  const [rangeOpen, setRangeOpen] = useState(false);
  const [layout, setLayout] = useState<TrackerLayout>(() => {
    if (typeof window === 'undefined') return DEFAULT_TRACKER_LAYOUT;
    return parseTrackerLayout(window.localStorage.getItem(LAYOUT_KEY));
  });

  useEffect(() => {
    try { window.localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout)); } catch { /* Layout remains usable without storage. */ }
  }, [layout]);

  const sections = layout.order.filter(section => !layout.hidden.includes(section));
  const resetLayout = (): void => setLayout({ order: [...DEFAULT_TRACKER_LAYOUT.order], hidden: [] });

  return <section className={styles.dashboard} aria-labelledby="master-dashboard-title">
    <header className={styles.commandBar}>
      <div className={styles.titleBlock}>
        <span className={styles.eyebrow}>NBC SALES / OPERATING VIEW</span>
        <h1 id="master-dashboard-title">See the business.<br /><em>Run the next move.</em></h1>
        <p>A single view for the numbers behind revenue, pipeline and the conversations that shape both.</p>
      </div>
      <div className={styles.commandActions}>
        <span className={styles.previewBadge}><Sparkles size={13} /> Preview data</span>
        <div className={styles.periodControl}><button className={styles.period} type="button" aria-expanded={rangeOpen} onClick={() => setRangeOpen(value => !value)}><CalendarDays size={15} /> {range}</button>{rangeOpen && <div className={styles.rangeMenu} role="menu"><span>Preview period</span>{['Last 7 days', 'Sep 1 – Sep 30, 2026', 'Quarter to date'].map(option => <button key={option} type="button" role="menuitem" onClick={() => { setRange(option); setRangeOpen(false); }}>{option}</button>)}</div>}</div>
        <button className={styles.customizeButton} type="button" aria-expanded={customizing} onClick={() => setCustomizing(value => !value)}><Settings2 size={16} /> Customize</button>
      </div>
    </header>

    <nav className={styles.tabs} aria-label="Master Dashboard views">
      {TABS.map(item => <button key={item} type="button" aria-current={tab === item ? 'page' : undefined} onClick={() => setTab(item)}>{item}</button>)}
    </nav>

    {customizing && <CustomizationPanel layout={layout} onChange={setLayout} onClose={() => setCustomizing(false)} onReset={resetLayout} />}
    {tab === 'Overview' && <Overview sections={sections} />}
    {tab === 'Revenue & pipeline' && <RevenuePipeline />}
    {tab === 'Sales quality' && <SalesQuality />}
    {tab === 'Acquisition' && <Acquisition />}
    {tab === 'Funnel' && <Funnel />}
    {tab === 'Accounts & journeys' && <AccountsJourneys />}
    {tab === 'Data sources' && <DataSources />}

    <footer className={styles.dataNote}><span><i /> Preview data only</span><p>Live data replaces a widget only when its connected source is verified. Missing data stays pending — it never becomes zero.</p><a href="/integrations">Review integrations <ChevronRight size={14} /></a></footer>
  </section>;
}

function CustomizationPanel({ layout, onChange, onClose, onReset }: { layout: TrackerLayout; onChange: (layout: TrackerLayout) => void; onClose: () => void; onReset: () => void }) {
  return <aside className={styles.customization} aria-label="Customize dashboard">
    <header><div><span className={styles.panelKicker}>YOUR OPERATING VIEW</span><h2>Customize dashboard</h2></div><button type="button" className={styles.iconButton} onClick={onClose} aria-label="Close customization"><X size={18} /></button></header>
    <p>Show what matters today, then set the order that matches how you run the business. This layout is saved only in this browser.</p>
    <div className={styles.customList}>{layout.order.map((section, index) => {
      const hidden = layout.hidden.includes(section);
      return <div className={styles.customItem} key={section}><button type="button" className={styles.visibilityButton} onClick={() => onChange(toggleTrackerSection(layout, section))} aria-pressed={!hidden}>{hidden ? <EyeOff size={16} /> : <Eye size={16} />}<span>{SECTION_COPY[section].title}</span></button><div className={styles.moveActions} aria-label={`Move ${SECTION_COPY[section].title}`}><button type="button" onClick={() => onChange(moveTrackerSection(layout, section, -1))} disabled={index === 0} aria-label={`Move ${SECTION_COPY[section].title} up`}><ArrowUp size={15} /></button><button type="button" onClick={() => onChange(moveTrackerSection(layout, section, 1))} disabled={index === layout.order.length - 1} aria-label={`Move ${SECTION_COPY[section].title} down`}><ArrowDown size={15} /></button></div></div>;
    })}</div>
    <button type="button" className={styles.resetButton} onClick={onReset}>Reset default layout</button>
  </aside>;
}

function Overview({ sections }: { sections: TrackerSectionId[] }) {
  const [focus, setFocus] = useState<number | null>(null);
  const point = focus === null ? null : DEMO_REVENUE_SERIES[focus];
  const path = smoothPath(DEMO_REVENUE_SERIES, 800, 210);
  const sectionsById: Record<TrackerSectionId, React.ReactNode> = { business: <BusinessPulse key="business" />, acquisition: <AcquisitionPreview key="acquisition" />, sales: <SalesPreview key="sales" />, signals: <QualitySignals key="signals" /> };
  const handleChartMove = (event: React.MouseEvent<SVGSVGElement>): void => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width));
    setFocus(Math.round(ratio * (DEMO_REVENUE_SERIES.length - 1)));
  };
  return <div className={styles.overview}>
    <section className={styles.heroGrid} aria-label="Cash collection overview">
      <article className={styles.revenueHero}><div className={styles.cardHeading}><span>Cash collected</span><button type="button" aria-label="More options for cash collected"><MoreHorizontal size={18} /></button></div><div className={styles.heroValue}><strong>$297.5K</strong><span>Preview total · Stripe mapping pending</span></div><div className={styles.chartWrap}><svg className={styles.revenueChart} viewBox="0 0 800 210" preserveAspectRatio="none" role="img" aria-label="Preview cash collection trend over 30 days" onMouseMove={handleChartMove} onMouseLeave={() => setFocus(null)}><path d={`${path} L 800 210 L 0 210 Z`} className={styles.chartFill} /><path d={path} className={styles.chartLine} />{focus !== null && <line className={styles.chartGuide} x1={focus * 800 / (DEMO_REVENUE_SERIES.length - 1)} x2={focus * 800 / (DEMO_REVENUE_SERIES.length - 1)} y1="8" y2="210" />}</svg>{point !== null && <div className={styles.chartTooltip} role="status">Day {(focus ?? 0) + 1}<strong>${point}K</strong></div>}</div><div className={styles.axis}><span>Sep 1</span><span>Move across the chart to inspect</span><span>Sep 30</span></div></article>
      <article className={styles.nextMove}><span className={styles.cardEyebrow}>OPERATING LENS</span><h2>Know what changed before you decide what to do next.</h2><p>Connect the source behind each number, then follow the trail from spend to conversation to revenue.</p><div className={styles.lensList}><span><i className={styles.blueDot} /> Acquisition → booked calls</span><span><i className={styles.goldDot} /> Calls → sales quality</span><span><i className={styles.inkDot} /> Revenue → source attribution</span></div></article>
    </section>
    <div className={styles.sectionStack}>{sections.map(section => sectionsById[section])}</div>
  </div>;
}

function BusinessPulse() {
  const metrics = [{ label: 'Pipeline created', value: '$412K', meta: 'Preview · GHL opportunity value' }, { label: 'Calls booked', value: '186', meta: 'Preview · GHL calendar events' }, { label: 'Calls showed', value: '110', meta: 'Preview · appointment outcomes' }, { label: 'Close rate', value: '26.4%', meta: 'Preview · won opportunities' }];
  return <section className={styles.businessSection} aria-labelledby="business-pulse-title"><SectionHeading eyebrow="THE WEEK AT A GLANCE" title="Business pulse" copy="A common language for pipeline, calls and commercial outcomes." /><div className={styles.metricGrid}>{metrics.map(metric => <article key={metric.label}><span>{metric.label}</span><strong>{metric.value}</strong><small>{metric.meta}</small></article>)}</div></section>;
}

function AcquisitionPreview() {
  const campaign = DEMO_CAMPAIGNS[0];
  return <section className={styles.splitSection} aria-labelledby="acquisition-title"><div className={styles.sectionIntro}><SectionHeading eyebrow="FROM ATTENTION TO APPOINTMENT" title="Acquisition, with downstream context." copy="A campaign does not end at a click. It needs a trace through calls, show rate and revenue." /><button type="button" className={styles.textAction}>Open acquisition view <ChevronRight size={15} /></button></div><article className={styles.campaignPreview}><div className={styles.cardHeading}><span>Top preview campaign</span><TrendingUp size={17} /></div><h3>{campaign.name}</h3><div className={styles.campaignStats}><div><span>Spend</span><strong>{money(campaign.spendCents)}</strong></div><div><span>Calls</span><strong>{campaign.calls}</strong></div><div><span>Sales</span><strong>{campaign.sales}</strong></div></div><p><CircleAlert size={14} /> Meta source is not verified. This is a preview of the relationship the view will show.</p></article></section>;
}

function SalesPreview() {
  return <section className={styles.salesSection} aria-labelledby="sales-performance-title"><SectionHeading eyebrow="THE CONVERSATION LAYER" title="Sales performance needs more than a call count." copy="Surface the movement from booked call to show, offer and close — with an obvious place to investigate the gap." /><div className={styles.salesGrid}>{DEMO_REPS.map(rep => <article className={styles.repCard} key={rep.name}><header><span className={styles.repInitial}>{rep.name.slice(-1)}</span><div><h3>{rep.name}</h3><p>Preview rep view</p></div></header><div className={styles.repMetrics}><div><span>Show rate</span><strong>{pct(rep.showRate)}</strong></div><div><span>Closing rate</span><strong>{pct(rep.closingRate)}</strong></div><div><span>Revenue</span><strong>{money(rep.revenueCents)}</strong></div></div><button type="button">View performance <ChevronRight size={15} /></button></article>)}</div></section>;
}

function QualitySignals() {
  return <section className={styles.signalSection} aria-labelledby="quality-signals-title"><SectionHeading eyebrow="WHAT NUMBERS ALONE CANNOT EXPLAIN" title="Quality signals" copy="Objections turn a dashboard from reporting into a way to improve the next conversation." /><div className={styles.signalGrid}><article className={styles.objectionCard}><div className={styles.cardHeading}><span>Objection intelligence</span><Target size={17} /></div><h3>Waiting for authorized Caller transcripts.</h3><p>When conversation data is available, this area will group repeated objections, timestamps and the revenue stage they affect.</p><span className={styles.pendingTag}>Source pending</span></article><article className={styles.coverageCard}><div className={styles.cardHeading}><span>Source coverage</span><Layers3 size={17} /></div><h3>What is ready to become real?</h3><SourceRow name="GoHighLevel" detail="Pipeline + calendar" state="Pending verification" /><SourceRow name="Meta Ads" detail="Spend + attribution" state="Not connected" /><SourceRow name="Stripe" detail="Cash collected" state="Not connected" /></article></div></section>;
}

function SourceRow({ name, detail, state }: { name: string; detail: string; state: string }) { return <div className={styles.sourceRow}><span /><div><strong>{name}</strong><small>{detail}</small></div><em>{state}</em></div>; }

function RevenuePipeline() {
  return <section className={styles.tabSurface}><SectionHeading eyebrow="REVENUE / PIPELINE" title="Revenue gains context when you can see the path into it." copy="Inspect what is open, what progressed and where the next follow-up belongs. All values are preview until GHL and Stripe are verified." />
    <div className={styles.pipelineGrid}><MetricCard label="Open pipeline" value="$412K" meta="Preview · GHL opportunities" icon={<GitBranch size={16} />} /><MetricCard label="Won opportunities" value="43" meta="Preview · GHL outcomes" icon={<CircleCheck size={16} />} /><MetricCard label="Cash collected" value="$297.5K" meta="Preview · Stripe mapping" icon={<CircleDollarSign size={16} />} /><MetricCard label="Forecast coverage" value="1.4×" meta="Preview · target definition pending" icon={<Target size={16} />} /></div>
    <div className={styles.pipelineWorkspace}><article className={styles.pipelineBoard}><div className={styles.surfaceHeader}><div><span>PIPELINE MAP</span><h3>Every stage has a next action.</h3></div><button type="button" aria-label="Filter preview pipeline"><Filter size={15} /> Filter</button></div><div className={styles.stageGrid}>{DEMO_PIPELINE_STAGES.map(stage => <div key={stage.label} className={styles.stageColumn}><header><span className={`${styles.stageDot} ${styles[stage.accent]}`} /><strong>{stage.label}</strong><em>{stage.count}</em></header><p>{money(stage.valueCents)}</p><small>Preview value</small><button type="button">Open records <ChevronRight size={14} /></button></div>)}</div></article>
      <article className={styles.activityPanel}><div className={styles.surfaceHeader}><div><span>REVENUE ACTIVITY</span><h3>What moved recently.</h3></div><ReceiptText size={17} /></div><div className={styles.activityList}>{DEMO_REVENUE_ACTIVITY.map(event => <div key={`${event.label}-${event.account}`}><span className={styles.activityMarker}><Clock3 size={13} /></span><div><strong>{event.label}</strong><p>{event.account} · {event.when}</p></div><em>{event.amountCents === null ? '—' : money(event.amountCents)}</em></div>)}</div><p className={styles.previewFootnote}>Illustrative events only. Real activity requires verified source events.</p></article></div>
  </section>;
}

function MetricCard({ label, value, meta, icon }: { label: string; value: string; meta: string; icon: React.ReactNode }) { return <article className={styles.metricCard}><header><span>{label}</span>{icon}</header><strong>{value}</strong><p>{meta}</p></article>; }

function SalesQuality() {
  return <section className={styles.tabSurface}><SectionHeading eyebrow="SALES QUALITY" title="A scorecard should lead back to the conversation." copy="Measure the handoff from booked call to close, then investigate the conversation rather than guessing. Metrics remain preview until sources are authorized." />
    <div className={styles.salesQualityGrid}><article className={styles.conversionCard}><div className={styles.surfaceHeader}><div><span>CONVERSION PATH</span><h3>Where the conversation changes.</h3></div><PlayCircle size={18} /></div><div className={styles.conversionPath}>{[{ label: 'Booked', value: '186' }, { label: 'Showed', value: '110' }, { label: 'Offer', value: '62' }, { label: 'Won', value: '43' }].map((step, index) => <div key={step.label}><span>{step.label}</span><strong>{step.value}</strong>{index > 0 && <em>{pct(Number(step.value) / Number(['186', '110', '62', '43'][index - 1]))}</em>}</div>)}</div><p className={styles.previewFootnote}>Preview conversion path · GHL outcomes and Caller event mapping pending.</p></article>
      <article className={styles.coachingCard}><span className={styles.cardEyebrow}>CONVERSATION INTELLIGENCE</span><h3>Coaching begins with evidence.</h3><p>Once authorized transcripts arrive, this view will connect themes, timestamps and deal outcomes without asking a manager to read every call.</p><div><span><CircleDashed size={14} /> Transcript ingestion pending</span><span><CircleDashed size={14} /> Objection taxonomy pending</span></div><a href="/integrations">Review source setup <ChevronRight size={14} /></a></article></div>
    <div className={styles.repScorecard}><div className={styles.surfaceHeader}><div><span>TEAM SCORECARD</span><h3>Comparable performance, with the gap visible.</h3></div><button type="button"><ListFilter size={15} /> All reps</button></div><div className={styles.repTable}><div className={styles.repTableHead}><span>Rep</span><span>Booked</span><span>Showed</span><span>Offers</span><span>Won</span><span>Revenue</span><span>Next review</span></div>{DEMO_REPS.map(rep => <div className={styles.repTableRow} key={rep.name}><span><i>{rep.name.slice(-1)}</i>{rep.name}<small>Preview profile</small></span><span>{rep.totalCalls}</span><span>{rep.showedCalls} <small>{pct(rep.showRate)}</small></span><span>{rep.offersMade}</span><span>{rep.closedCalls} <small>{pct(rep.closingRate)}</small></span><span>{money(rep.revenueCents)}</span><button type="button">Open call lens <ChevronRight size={13} /></button></div>)}</div></div>
  </section>;
}

function Acquisition() {
  const totalSpend = DEMO_CAMPAIGNS.reduce((sum, campaign) => sum + campaign.spendCents, 0); const totalRevenue = DEMO_CAMPAIGNS.reduce((sum, campaign) => sum + campaign.revenueCents, 0);
  return <section className={styles.tabSurface}><SectionHeading eyebrow="ACQUISITION" title="Spend only matters when it is connected to the sales outcome." copy="Preview campaign data shows the intended evaluation model; Meta is not connected." /><div className={styles.tableSurface}><table><thead><tr><th>Campaign</th><th>Spend</th><th>Calls</th><th>Show rate</th><th>Revenue</th><th>ROAS</th></tr></thead><tbody>{DEMO_CAMPAIGNS.map(campaign => <tr key={campaign.name}><td>{campaign.name}</td><td>{money(campaign.spendCents)}</td><td>{campaign.calls}</td><td>{pct(campaign.showRate)}</td><td>{money(campaign.revenueCents)}</td><td>{campaign.spendCents ? `${(campaign.revenueCents / campaign.spendCents).toFixed(1)}x` : '—'}</td></tr>)}<tr className={styles.totalRow}><td>Total preview</td><td>{money(totalSpend)}</td><td>{DEMO_CAMPAIGNS.reduce((sum, campaign) => sum + campaign.calls, 0)}</td><td>—</td><td>{money(totalRevenue)}</td><td>—</td></tr></tbody></table></div></section>;
}

function Funnel() {
  const values = DEMO_FUNNEL.map(step => step.value); const logMin = Math.log10(Math.min(...values)); const logMax = Math.log10(Math.max(...values)); const width = (value: number): number => 20 + ((Math.log10(value) - logMin) / Math.max(0.0001, logMax - logMin)) * 80;
  const lowestConversion = DEMO_FUNNEL.slice(1).map((step, index) => ({ from: DEMO_FUNNEL[index].label, to: step.label, ratio: step.value / DEMO_FUNNEL[index].value })).sort((a, b) => a.ratio - b.ratio)[0];
  return <section className={styles.tabSurface}><SectionHeading eyebrow="FUNNEL" title="A funnel should make the drop-off obvious." copy="Preview values use a log scale so every stage stays visible; the raw count and conversion remain alongside it." /><div className={styles.funnelLayout}><article className={styles.funnelSurface}><div className={styles.surfaceHeader}><div><span>FULL JOURNEY</span><h3>From attention to sale.</h3></div><button type="button"><Filter size={15} /> All sources</button></div><div className={styles.funnelList}>{DEMO_FUNNEL.map((step, index) => { const previous = index ? DEMO_FUNNEL[index - 1].value : null; return <div className={styles.funnelRow} key={step.label}><span>{step.label}</span><div><i style={{ width: `${width(step.value)}%` }} /></div><strong>{compact(step.value)}</strong><em>{previous ? pct(step.value / previous) : '—'}</em></div>; })}</div></article><aside className={styles.funnelInsight}><span className={styles.cardEyebrow}>NEXT INVESTIGATION</span><h3>Follow the smallest handoff.</h3><p>The preview identifies the most constrained transition as <strong>{lowestConversion.from} → {lowestConversion.to}</strong>. A verified source will show the underlying records, campaign and owner.</p><div><span>Preview conversion</span><strong>{pct(lowestConversion.ratio)}</strong></div><button type="button">Open affected records <ChevronRight size={14} /></button></aside></div></section>;
}

function AccountsJourneys() {
  const [selected, setSelected] = useState(0);
  const account = DEMO_JOURNEYS[selected];
  return <section className={styles.tabSurface}><SectionHeading eyebrow="ACCOUNTS / JOURNEYS" title="See the account behind the metric." copy="A journey pulls acquisition, appointments, opportunity movement and owner action into one readable path. Records below are anonymous previews." />
    <div className={styles.journeysWorkspace}><article className={styles.journeyList}><div className={styles.surfaceHeader}><div><span>ACCOUNT QUEUE</span><h3>Accounts needing context.</h3></div><button type="button" aria-label="Search preview accounts"><Search size={15} /> Search</button></div><div>{DEMO_JOURNEYS.map((journey, index) => <button type="button" key={journey.account} className={selected === index ? styles.journeyRowActive : styles.journeyRow} onClick={() => setSelected(index)}><span className={styles.accountGlyph}>{journey.account.slice(-1)}</span><span><strong>{journey.account}</strong><small>{journey.source} · {journey.owner}</small></span><span><em className={journey.tone === 'attention' ? styles.attention : styles.steady}>{journey.signal}</em><b>{money(journey.valueCents)}</b></span></button>)}</div><p className={styles.previewFootnote}>Names are illustrative. A verified CRM/GHL source controls account access.</p></article>
      <article className={styles.journeyDetail}><div className={styles.detailTop}><div><span className={styles.cardEyebrow}>ACCOUNT JOURNEY / PREVIEW</span><h3>{account.account}</h3><p>{account.source} · owner {account.owner}</p></div><span className={styles.stageBadge}>{account.stage}</span></div><div className={styles.journeyValue}><span>Open value</span><strong>{money(account.valueCents)}</strong><small>Preview opportunity value</small></div><ol className={styles.timeline}>{DEMO_JOURNEY_EVENTS.map((event, index) => <li key={event.label}><span>{index + 1}</span><div><strong>{event.label}</strong><p>{event.detail}</p></div><em>{event.when}</em></li>)}</ol><div className={styles.nextAction}><Target size={16} /><div><span>Next action</span><strong>Confirm follow-up ownership before the decision window closes.</strong></div><button type="button">Assign owner</button></div></article></div>
  </section>;
}

function DataSources() {
  const sources = [
    { name: 'GoHighLevel', icon: <GitBranch size={18} />, state: 'Pending verification', fields: 'Opportunities, calendar events, pipeline stage', copy: 'The connector contract exists. A private integration token and one real range are needed to verify mappings.' },
    { name: 'Stripe', icon: <CircleDollarSign size={18} />, state: 'Not connected', fields: 'Payments, refunds, currency, collection date', copy: 'Cash collected remains preview until an authorized revenue source and business definition are selected.' },
    { name: 'Meta Ads', icon: <TrendingUp size={18} />, state: 'Not connected', fields: 'Spend, campaign, ad set, attribution window', copy: 'Acquisition remains a product-ready view; it does not claim spend or ROAS without the account.' },
    { name: 'Caller', icon: <PhoneCall size={18} />, state: 'Source design pending', fields: 'Authorized transcripts, outcomes, objection tags', copy: 'Sales quality will receive only explicitly authorized conversation data and never fabricate a coaching score.' },
  ];
  return <section className={styles.tabSurface}><SectionHeading eyebrow="DATA SOURCES" title="A number earns trust when its source is clear." copy="This is the handoff point for tomorrow’s connection work: every provider has a destination, expected fields and a reason for its current state." />
    <div className={styles.sourceHero}><Database size={21} /><div><strong>No source is silently treated as zero.</strong><p>Verify one provider, map its fields and replace only the widgets it supports. The rest remain pending.</p></div><a href="/integrations">Open integrations <ChevronRight size={15} /></a></div><div className={styles.sourceCards}>{sources.map(source => <article key={source.name}><header><span>{source.icon}</span><em>{source.state}</em></header><h3>{source.name}</h3><p>{source.copy}</p><div><span>Expected data</span><strong>{source.fields}</strong></div><a href="/integrations">Set up source <ChevronRight size={14} /></a></article>)}</div>
  </section>;
}

function SectionHeading({ eyebrow, title, copy }: { eyebrow: string; title: string; copy: string }) { return <header className={styles.sectionHeading}><span>{eyebrow}</span><h2>{title}</h2><p>{copy}</p></header>; }
