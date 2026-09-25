"use client";
import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, CalendarDays, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { useWorkspaceAccess } from '@/components/workspace/WorkspaceAccess';
import type { CalendarFeed } from '@/lib/calendar-feed';
import { safeMeetingUrl } from '@/lib/calendar-feed';
import { calendarDay, calendarDate, calendarMonthDays, calendarEventsOnDay, moveCalendarDay, moveCalendarMonth } from '@/lib/calendar-month';
import { MemberWorkspace } from './MemberWorkspace';
import styles from './Calendar.module.css';

export function CalendarWorkspace() {
  const { token, user } = useWorkspaceAccess();
  const [state, setState] = useState<{ token: string; feed: CalendarFeed } | null>(null);
  const [loading, setLoading] = useState(true), [error, setError] = useState(''), [version, setVersion] = useState(0);
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7) + '-01');
  const [selected, setSelected] = useState(() => new Date().toISOString().slice(0, 10));
  const dayButtons = useRef<Record<string, HTMLButtonElement | null>>({});
  const data = state?.token === token ? state.feed : null;
  const timezone = data?.timezone || 'UTC';
  const today = calendarDay(new Date(), timezone);
  const events = data?.events ?? [];
  const days = calendarMonthDays(month);
  const selectedEvents = calendarEventsOnDay(events, selected, timezone);
  const monthLabel = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(calendarDate(month));
  const dayLabel = (day: string): string => new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(calendarDate(day));
  useEffect(() => { const day = calendarDay(new Date(), timezone); setSelected(day); setMonth(day.slice(0, 7) + '-01'); }, [timezone]);
  useEffect(() => {
    if (!token) return;
    const controller = new AbortController(); setLoading(true); setError('');
    void fetch('/api/calendar', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(30000)]) })
      .then(async response => { if (!response.ok) throw new Error('Unavailable'); return response.json() as Promise<CalendarFeed>; })
      .then(feed => { if (!controller.signal.aborted) setState({ token, feed }); })
      .catch(() => { if (!controller.signal.aborted) setError('Your schedule could not be refreshed. Please try again.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [token, version]);
  function choose(day: string, focus = false): void {
    setSelected(day); if (day.slice(0, 7) !== month.slice(0, 7)) setMonth(day.slice(0, 7) + '-01');
    if (focus) requestAnimationFrame(() => dayButtons.current[day]?.focus());
  }
  function changeMonth(offset: number): void { const next = moveCalendarMonth(month, offset); setMonth(next); setSelected(next); }
  return <div className={styles.page}>
    <header><div><h1>Calendar</h1><p>Program calls, coaching and time together.</p></div><button disabled={loading} aria-label="Refresh calendar" onClick={() => setVersion(value => value + 1)}><RefreshCw size={16} />{loading ? 'Refreshing…' : 'Refresh'}</button></header>
    {error && <p role="alert" className={styles.error}>{error}{data ? ' Previously loaded sessions are still shown.' : ''}</p>}
    <section className={styles.monthPanel} aria-label="Monthly calendar">
      <div className={styles.monthToolbar}><div className={styles.monthNavigation}><button aria-label="Previous month" onClick={() => changeMonth(-1)}><ChevronLeft size={20} /></button><h2 aria-live="polite">{monthLabel}</h2><button aria-label="Next month" onClick={() => changeMonth(1)}><ChevronRight size={20} /></button></div><div className={styles.monthOptions}><span>{timezone}</span><button onClick={() => choose(today)}>Today</button></div></div>
      <table className={styles.monthGrid} aria-label={`${monthLabel} calendar`}><thead><tr>{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(name => <th key={name} scope="col">{name}</th>)}</tr></thead><tbody>{Array.from({ length: 6 }, (_, week) => <tr key={week}>{days.slice(week * 7, week * 7 + 7).map(day => {
        const entries = calendarEventsOnDay(events, day, timezone);
        return <td key={day}><button ref={element => { dayButtons.current[day] = element; }} className={`${styles.day} ${day.slice(0, 7) !== month.slice(0, 7) ? styles.outsideMonth : ''} ${selected === day ? styles.selectedDay : ''}`} aria-label={`${dayLabel(day)}${day === today ? ', today' : ''}, ${entries.length} sessions`} aria-pressed={selected === day} tabIndex={selected === day ? 0 : -1} onClick={() => choose(day)} onKeyDown={event => {
          const offsets: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7, Home: -calendarDate(day).getUTCDay(), End: 6 - calendarDate(day).getUTCDay() };
          if (!(event.key in offsets)) return; event.preventDefault(); choose(moveCalendarDay(day, offsets[event.key]), true);
        }}><span className={day === today ? styles.todayNumber : styles.dayNumber}>{Number(day.slice(8))}</span>{entries.slice(0, 2).map(entry => <span className={styles.eventChip} key={entry.id}>{entry.title}</span>)}{entries.length > 2 && <span className={styles.moreEvents}>+{entries.length - 2} more</span>}{entries.length > 0 && <span className={styles.mobileCount}>{entries.length} <span>sessions</span></span>}</button></td>;
      })}</tr>)}</tbody></table>
      <div className={styles.monthFootnote}>{loading ? <span role="status">Loading your schedule…</span> : <span>Showing upcoming sessions available to your account.</span>}{data?.externalStatus === 'not_connected' && <span>Mentoring calendar not connected yet</span>}{data?.externalStatus === 'unavailable' && <span>External calendar unavailable · NBC sessions remain visible</span>}</div>
    </section>
    <section className={styles.agenda} aria-label="Selected day sessions"><div className={styles.sectionTitle}><h2>{new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' }).format(calendarDate(selected))}</h2><span>{selectedEvents.length ? `${selectedEvents.length} sessions` : ''}</span></div>
      {selectedEvents.length ? <ul>{selectedEvents.map(event => { const joinUrl = safeMeetingUrl(event.join_url); return <li key={event.id}><span className={styles.date}><CalendarDays size={22} /></span><div><h3>{event.title}</h3><p>{event.all_day ? 'All day' : new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZoneName: 'short', timeZone: timezone }).format(new Date(event.starts_at))} · {event.source === 'google' ? 'Mentoring calendar' : 'NBC session'}</p></div>{joinUrl ? <a href={joinUrl} target="_blank" rel="noopener noreferrer">Join call<ArrowUpRight size={16} /></a> : <small className={styles.waiting}>Joining link pending</small>}</li>; })}</ul> : <div className={styles.dayEmpty}><CalendarDays size={25} /><div><h3>{loading ? 'Loading sessions…' : error && !data ? 'Schedule unavailable' : 'Nothing scheduled here yet'}</h3><p>{error && !data ? 'Refresh to try loading your sessions again.' : 'Sessions from your upcoming schedule will appear on their dates.'}</p></div></div>}
    </section>
    {user?.role !== 'student' && <details className={styles.manage}><summary>Manage NBC sessions</summary><MemberWorkspace section="calendar" /></details>}
  </div>;
}
