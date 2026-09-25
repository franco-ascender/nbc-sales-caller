import type { CallSession } from "./caller-types";
import type { CallerLead } from "./caller-crm";

export interface ActivityDay { date: string; practice: number; phone: number; total: number }
export const pipelineGroups = [
  { label: "New & queued", stages: ["new", "queued"], color: "#4266de" },
  { label: "Contacted", stages: ["contacted"], color: "#85a4ff" },
  { label: "Qualified & booked", stages: ["qualified", "booked"], color: "#edbc55" },
  { label: "Won", stages: ["won"], color: "#55a895" },
  { label: "Closed & excluded", stages: ["lost", "do_not_call"], color: "#c4ccdc" },
] as const;

export function summaryMetrics(leads: readonly CallerLead[], sessions: readonly CallSession[]) {
  const realLeads = leads.filter(lead => !lead.is_demo);
  const completed = sessions.filter(session => !session.is_demo && session.status === "completed");
  return {
    leads: realLeads.length,
    ready: realLeads.filter(lead => !lead.do_not_call && (lead.stage === "new" || lead.stage === "queued")).length,
    conversations: completed.length,
    practiceMinutes: Math.round(completed.filter(session => session.channel === "web").reduce((sum, session) => sum + Math.max(0, session.duration_seconds ?? 0), 0) / 60),
    pipeline: pipelineGroups.map(group => ({ ...group, value: realLeads.filter(lead => (group.stages as readonly string[]).includes(lead.do_not_call ? "do_not_call" : lead.stage)).length })),
    recent: [...completed].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)).slice(0, 3),
  };
}

export function activityDays(sessions: readonly CallSession[], days: 7 | 30, now: Date): ActivityDay[] {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const rows = Array.from({ length: days }, (_, index) => ({ date: new Date(today - (days - 1 - index) * 86400000).toISOString().slice(0, 10), practice: 0, phone: 0, total: 0 }));
  const dates = new Map(rows.map(row => [row.date, row]));
  for (const session of sessions) {
    if (session.is_demo || session.status !== "completed" || !Number.isFinite(Date.parse(session.created_at))) continue;
    const row = dates.get(new Date(session.created_at).toISOString().slice(0, 10));
    if (!row || Date.parse(session.created_at) > now.getTime()) continue;
    row[session.channel === "web" ? "practice" : "phone"]++; row.total++;
  }
  return rows;
}
