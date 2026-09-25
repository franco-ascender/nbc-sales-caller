"use client";
import { useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, AudioLines } from 'lucide-react';
import type { ActivityDay } from '@/lib/summary-metrics';
import { smoothLine } from '@/lib/overview-layout';
import styles from './PlatformHome.module.css';
const dayLabel = (value: string) => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(value + 'T00:00:00Z'));
export function ActivityChart({ rows, loading, unavailable }: { rows: ActivityDay[]; loading: boolean; unavailable: boolean }) {
  const svg = useRef<SVGSVGElement>(null), [bounds,setBounds]=useState({width:600,height:220});
  useEffect(()=>{if(!svg.current)return;const observer=new ResizeObserver(([entry])=>setBounds({width:Math.max(100,entry.contentRect.width),height:Math.max(60,entry.contentRect.height)}));observer.observe(svg.current);return()=>observer.disconnect();},[]);
  const right=bounds.width-18, bottom=bounds.height-25, plotHeight=Math.max(20,bottom-15);
  const [selected, setSelected] = useState<number | null>(null); const id = useId().replace(/:/g, '');
  const index = selected === null || !rows.length ? null : Math.min(selected, rows.length - 1), chosen = index === null ? null : rows[index];
  const max = Math.ceil(Math.max(4, ...rows.map(row => row.total)) / 4) * 4;
  const points = rows.map((row, i) => ({ x: 32 + i * (right-32) / Math.max(1, rows.length - 1), y: bottom - row.total / max * plotHeight }));
  const path = smoothLine(points), total = rows.reduce((sum, row) => sum + row.total, 0), valid = !loading && !unavailable && total > 0;
  return <div className={styles.chartWrap}>
    <div className={styles.chartReadout} aria-live="polite">{chosen && valid ? <><strong>{dayLabel(chosen.date)}</strong><span>{chosen.practice} practice · {chosen.phone} phone</span></> : <><i />Completed conversations<span className={styles.chartHint}>Explore the curve ↗</span></>}</div>
    <svg ref={svg} viewBox={`0 0 ${bounds.width} ${bounds.height}`} className={styles.activityChart} role="img" tabIndex={valid ? 0 : undefined} aria-label={!valid ? loading ? 'Loading activity' : unavailable ? 'Activity unavailable' : 'No completed conversations in this period' : chosen ? `${dayLabel(chosen.date)}: ${chosen.total} completed conversations` : 'Completed conversations by day. Use left and right arrow keys to explore.'}
      onKeyDown={event => { if (!valid) return; if (['ArrowLeft', 'ArrowRight'].includes(event.key)) { event.preventDefault(); setSelected(value => Math.max(0, Math.min(rows.length - 1, (value ?? rows.length - 1) + (event.key === 'ArrowLeft' ? -1 : 1)))); } if (event.key === 'Escape') setSelected(null); }}
      onPointerMove={event => { if (!valid) return; const box = event.currentTarget.getBoundingClientRect(), x = (event.clientX - box.left) / box.width * bounds.width; setSelected(Math.max(0, Math.min(rows.length - 1, Math.round((x - 32) / (right-32) * (rows.length - 1))))); }} onPointerLeave={() => setSelected(null)} onBlur={() => setSelected(null)}>
      <defs><linearGradient id={`${id}line`}><stop stopColor="var(--chart-1)" /><stop offset="55%" stopColor="var(--chart-2)" /><stop offset="100%" stopColor="var(--chart-3)" /></linearGradient><linearGradient id={`${id}area`} x1="0" y1="0" x2="0" y2="1"><stop stopColor="var(--chart-1)" stopOpacity=".22" /><stop offset="100%" stopColor="var(--chart-2)" stopOpacity="0" /></linearGradient><filter id={`${id}glow`} x="-20%" y="-60%" width="140%" height="220%"><feGaussianBlur stdDeviation="5" /></filter></defs>
      {[0, 1, 2, 3, 4].map(i => <g key={i}><line x1="32" x2={right} y1={15+i*plotHeight/4} y2={15+i*plotHeight/4} stroke="var(--chart-grid)" strokeDasharray="2 6" /><text x="20" y={19+i*plotHeight/4} textAnchor="end" className={styles.axisText}>{max * (4 - i) / 4}</text></g>)}
      {valid && <><path d={`${path} L${right},${bottom} L32,${bottom} Z`} fill={`url(#${id}area)`} className={styles.chartArea} /><path d={path} fill="none" stroke="var(--chart-1)" strokeWidth="7" opacity="var(--chart-glow)" filter={`url(#${id}glow)`} /><path d={path} fill="none" stroke={`url(#${id}line)`} strokeWidth="3" strokeLinecap="round" pathLength="1" className={styles.chartLine} />{index !== null && <g><line x1={points[index].x} x2={points[index].x} y1="15" y2={bottom} stroke="#a0c1f680" strokeDasharray="4 5" /><circle cx={points[index].x} cy={points[index].y} r="11" fill="#82cfea30" /><circle cx={points[index].x} cy={points[index].y} r="5" fill="#e2ffff" stroke="var(--chart-1)" strokeWidth="3" /></g>}</>}
      {rows.length > 0 && [0, Math.floor((rows.length - 1) / 2), rows.length - 1].map((i, n) => <text key={i} x={points[i].x} y={bounds.height-5} textAnchor={n === 0 ? 'start' : n === 2 ? 'end' : 'middle'} className={styles.axisText}>{dayLabel(rows[i].date)}</text>)}
    </svg>
    {!valid && <div className={styles.chartEmpty}><AudioLines size={27} /><strong>{loading ? 'Finding your rhythm…' : unavailable ? 'Activity is unavailable' : 'Your next conversation starts here.'}</strong><p>{unavailable ? 'Refresh your dashboard to try again.' : 'Your completed conversations will draw this curve.'}</p>{!loading && !unavailable && <Link href="/caller" className={styles.textButton}>Open Caller<ArrowUpRight size={15} /></Link>}</div>}
  </div>;
}
export function PipelineChart({ groups, loading, unavailable }: { groups: { label: string; color: string; value: number }[]; loading: boolean; unavailable: boolean }) {
  const [active, setActive] = useState<number | null>(null); const total = groups.reduce((sum, row) => sum + row.value, 0), colors = ['var(--chart-1)', '#709aef', '#8c77dc', '#dfb55e', '#9aa7bc']; let offset = 0;
  return <div className={styles.pipelineBody}><div className={styles.donutWrap}>
    <svg viewBox="0 0 220 220" role="img" aria-label={loading ? 'Loading pipeline' : unavailable ? 'Pipeline unavailable' : `Pipeline: ${total} saved leads`} className={styles.donut}><circle cx="110" cy="110" r="80" fill="none" stroke="var(--soft)" strokeWidth="17" />{total > 0 && !loading && !unavailable && groups.map((group, i) => { const portion = group.value / total * 100, start = offset; offset += portion; return group.value > 0 && <circle key={group.label} cx="110" cy="110" r="80" pathLength="100" fill="none" stroke={colors[i]} strokeWidth={active === i ? 21 : 17} strokeDasharray={`${Math.max(.1, portion - Math.min(1.8, portion * .15))} 100`} strokeDashoffset={-start} transform="rotate(-90 110 110)" opacity={active === null || active === i ? 1 : .25} className={styles.ringSegment} />; })}</svg>
    <div className={styles.donutLabel}><strong>{loading || unavailable ? '—' : (active === null ? total : groups[active].value).toLocaleString('en-US')}</strong><span>{active === null ? 'total leads' : groups[active].label}</span></div>
    </div><div className={styles.pipelineLegend}>{groups.map((group, i) => <button key={group.label} aria-pressed={active === i} disabled={loading || unavailable} onClick={() => setActive(active === i ? null : i)}><span><i style={{ background: colors[i] }} />{group.label}</span><strong>{loading || unavailable ? '—' : group.value}</strong></button>)}</div></div>;
}
