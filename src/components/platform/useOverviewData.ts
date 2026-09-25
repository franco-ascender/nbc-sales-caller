"use client";
import { useEffect, useState } from 'react';
import type { CallSession } from '@/lib/caller-types';
import type { CallerLead } from '@/lib/caller-crm';
import type { CalendarFeed } from '@/lib/calendar-feed';
import type { AcademyDocument, AcademyPage } from '@/lib/academy-storage-types';
export interface OverviewData { token: string; leads: CallerLead[] | null; sessions: CallSession[] | null; calendar: CalendarFeed | null; at: Date }
export async function overviewRequest<T>(path: string, token: string, signal?: AbortSignal): Promise<T> {
  const timeout = AbortSignal.timeout(20000);
  const response = await fetch(path, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store', signal: signal ? AbortSignal.any([signal, timeout]) : timeout });
  if (!response.ok) throw new Error(response.status === 403 ? 'Your lessons are not available for this account yet.' : 'This content could not be loaded. Please try again.');
  return response.json() as Promise<T>;
}
export function useOverviewData(token: string) {
  const [state, setState] = useState<OverviewData | null>(null), [loading, setLoading] = useState(true), [refresh, setRefresh] = useState(0);
  useEffect(() => {
    if (!token) return; const controller = new AbortController(); let active = true; setLoading(true);
    void Promise.allSettled([overviewRequest<{ leads: CallerLead[]; configured: boolean }>('/api/caller/leads', token, controller.signal), overviewRequest<{ sessions: CallSession[] }>('/api/caller/sessions', token, controller.signal), overviewRequest<CalendarFeed>('/api/calendar', token, controller.signal)]).then(([leads, sessions, calendar]) => {
      if (!active) return;
      setState({ token, leads: leads.status === 'fulfilled' && leads.value.configured ? leads.value.leads : null, sessions: sessions.status === 'fulfilled' ? sessions.value.sessions : null, calendar: calendar.status === 'fulfilled' ? calendar.value : null, at: new Date() }); setLoading(false);
    });
    return () => { active = false; controller.abort(); };
  }, [token, refresh]);
  return { data: state?.token === token ? state : null, loading, refresh: () => setRefresh(n => n + 1) };
}
export const readLessonInventory = (token: string, id: string, signal?: AbortSignal) => overviewRequest<{ inventory: AcademyDocument }>(`/api/academy/inventories/${encodeURIComponent(id)}`, token, signal);
export const listLessonInventories = (token: string, offset = 0, signal?: AbortSignal) => overviewRequest<AcademyPage>(`/api/academy/inventories?offset=${offset}`, token, signal);
