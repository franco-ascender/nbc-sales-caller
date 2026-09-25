import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Member, MemberMessage, MemberWorkspaceData } from "@/lib/member-types";
import { canManageStudent, MemberError, memberCredits, memberEventTimes, memberId, memberMeetingUrl, memberText, memberTimezone } from "@/lib/member-validation";

const MEMBER_FIELDS = "id,display_name,role,status,coach_id";
export async function readMemberSummary(actor: Member): Promise<{ completed: boolean; available: number }> {
  const db = store();
  const [profile, wallet] = await Promise.all([
    db.from("nbc_onboarding").select("completed_at").eq("member_id", actor.id).maybeSingle(),
    db.from("nbc_credit_wallets").select("balance,reserved").eq("member_id", actor.id).maybeSingle(),
  ]);
  const onboarding = checked(profile); const credits = checked(wallet);
  return { completed: Boolean(onboarding?.completed_at), available: Number(credits?.balance ?? 0) - Number(credits?.reserved ?? 0) };
}
function store(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL; const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new MemberError(503, "Member access is being prepared. Please try again later.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
function checked<T>(result: { data: T; error: { code?: string } | null }): T {
  if (result.error) {
    if (result.error.code === "23505") throw new MemberError(409, "This request conflicts with an existing item. Refresh before trying again.");
    throw new MemberError(503, "Your workspace could not be loaded or saved. Your changes are still on this page. Please try again.");
  }
  return result.data;
}
export async function requireMember(request: Request): Promise<Member> {
  const token = request.headers.get("authorization")?.match(/^Bearer (\S+)$/)?.[1];
  if (!token) throw new MemberError(401, "Sign in to your NBC account to continue.");
  const db = store(); const { data, error } = await db.auth.getUser(token);
  if (error || !data.user?.email_confirmed_at) throw new MemberError(401, "Your session has expired. Please sign in again.");
  const member = checked(await db.from("nbc_members").select(MEMBER_FIELDS).eq("id", data.user.id).maybeSingle()) as Member | null;
  if (!member || member.status !== "active") throw new MemberError(403, "Your account does not have an active NBC membership.");
  return member;
}
async function subjectFor(db: SupabaseClient, actor: Member, id: string): Promise<Member> {
  const subject = checked(await db.from("nbc_members").select(MEMBER_FIELDS).eq("id", memberId(id)).maybeSingle()) as Member | null;
  if (!subject || !canManageStudent(actor, subject)) throw new MemberError(404, "Member not found.");
  return subject;
}
export async function readMemberWorkspace(actor: Member, request: Request): Promise<MemberWorkspaceData> {
  const db = store(); const params = new URL(request.url).searchParams;
  const subject = await subjectFor(db, actor, params.get("member") || actor.id);
  let peopleQuery = db.from("nbc_members").select(MEMBER_FIELDS).eq("status", "active").order("display_name").limit(100);
  if (actor.role === "student") peopleQuery = peopleQuery.eq("id", actor.id);
  if (actor.role === "coach") peopleQuery = peopleQuery.eq("coach_id", actor.id).eq("role", "student");
  let calendarQuery = db.from("nbc_calendar").select("id,title,starts_at,ends_at,join_url,student_id").gte("ends_at", new Date().toISOString()).order("starts_at").limit(100);
  if (actor.role !== "admin" || subject.id !== actor.id) calendarQuery = calendarQuery.or(`student_id.is.null,student_id.eq.${subject.id}`);
  let messagesQuery = db.from("nbc_messages").select("id,author_id,body,created_at").eq("student_id", subject.id).order("created_at", { ascending: false }).order("id", { ascending: false }).limit(31);
  const cursor = params.get("before");
  if (cursor) {
    const [time, id, extra] = cursor.split("|");
    if (extra || !time || !/^\d{4}-\d{2}-\d{2}T[\d:.]+(?:Z|\+00:00)$/.test(time) || !Number.isFinite(Date.parse(time))) throw new MemberError(400, "Invalid message cursor.");
    messagesQuery = messagesQuery.or(`created_at.lt.${time},and(created_at.eq.${time},id.lt.${memberId(id)})`);
  }
  const results = await Promise.all([
    peopleQuery,
    db.from("nbc_onboarding").select("business,timezone,goal,questions,completed_at").eq("member_id", subject.id).maybeSingle(),
    calendarQuery,
    messagesQuery,
    db.from("nbc_tickets").select("id,member_id,title,body,status,created_at").eq("member_id", subject.id).order("created_at", { ascending: false }).limit(50),
    db.from("nbc_credit_wallets").select("balance,reserved").eq("member_id", subject.id).maybeSingle(),
    db.from("nbc_credit_entries").select("id,amount,reason,created_at").eq("member_id", subject.id).order("created_at", { ascending: false }).limit(50),
  ]);
  for (const result of results) checked<unknown>(result);
  const messages = results[3].data as MemberMessage[];
  const visible = messages.slice(0, 30); const last = visible.at(-1);
  const wallet = results[5].data;
  return {
    member: actor, subject, people: results[0].data as Member[], onboarding: results[1].data,
    events: results[2].data ?? [], messages: visible.reverse(), tickets: results[4].data ?? [],
    credits: { available: Number(wallet?.balance ?? 0) - Number(wallet?.reserved ?? 0), reserved: Number(wallet?.reserved ?? 0), entries: results[6].data ?? [] },
    nextMessages: messages.length > 30 && last ? `${last.created_at}|${last.id}` : null,
  };
}
export async function mutateMemberWorkspace(actor: Member, payload: unknown): Promise<void> {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new MemberError(400, "Use a valid request.");
  const body = payload as Record<string, unknown>; const db = store();
  if (body.action === "onboarding") {
    const existing = checked(await db.from("nbc_onboarding").select("completed_at").eq("member_id", actor.id).maybeSingle());
    const complete = body.complete === true;
    const requireFields = complete || Boolean(existing?.completed_at);
    const fields = { business: memberText(body.business, "business", 200, requireFields), timezone: memberTimezone(body.timezone), goal: memberText(body.goal, "goal", 2000, requireFields), questions: memberText(body.questions, "questions", 3000, false) };
    checked(await db.from("nbc_onboarding").upsert({ member_id: actor.id, ...fields, completed_at: complete ? (existing?.completed_at || new Date().toISOString()) : existing?.completed_at ?? null, updated_at: new Date().toISOString() }));
    return;
  }
  if (body.action === "event") {
    if (actor.role === "student") throw new MemberError(403, "Only your coaching team can schedule sessions.");
    const student = body.memberId ? await subjectFor(db, actor, memberId(body.memberId)) : null;
    if (!student && actor.role !== "admin") throw new MemberError(403, "Only an administrator can schedule a program-wide session.");
    if (student && student.role !== "student") throw new MemberError(400, "Choose a student for a private session.");
    checked(await db.from("nbc_calendar").insert({ id: memberId(body.id), creator_id: actor.id, student_id: student?.id ?? null, title: memberText(body.title, "session title", 160), ...memberEventTimes(body.startsAt, body.endsAt), join_url: memberMeetingUrl(body.joinUrl) }));
    return;
  }
  if (body.action === "assignCoach") {
    if (actor.role !== "admin") throw new MemberError(403, "Administrator access is required.");
    const student = await subjectFor(db, actor, memberId(body.memberId)); const coach = await subjectFor(db, actor, memberId(body.coachId));
    if (student.role !== "student" || coach.role !== "coach") throw new MemberError(400, "Choose a student and an active coach.");
    checked(await db.from("nbc_members").update({ coach_id: coach.id }).eq("id", student.id)); return;
  }
  const subject = await subjectFor(db, actor, body.memberId ? memberId(body.memberId) : actor.id);
  if (body.action === "message") {
    if (subject.role !== "student" || !subject.coach_id) throw new MemberError(409, "Your conversation will open once a coach is assigned.");
    const id = memberId(body.id); const text = memberText(body.body, "message", 3000);
    const old = checked(await db.from("nbc_messages").select("student_id,author_id,body").eq("id", id).maybeSingle());
    if (old) { if (old.student_id === subject.id && old.author_id === actor.id && old.body === text) return; throw new MemberError(409, "Message request conflict."); }
    checked(await db.from("nbc_messages").insert({ id, student_id: subject.id, author_id: actor.id, body: text })); return;
  }
  if (body.action === "ticket") {
    if (subject.id !== actor.id) throw new MemberError(403, "Create tickets from your own account.");
    const id = memberId(body.id); const title = memberText(body.title, "ticket title", 160); const text = memberText(body.body, "ticket details", 3000);
    const old = checked(await db.from("nbc_tickets").select("member_id,title,body").eq("id", id).maybeSingle());
    if (old) { if (old.member_id === actor.id && old.title === title && old.body === text) return; throw new MemberError(409, "Ticket request conflict."); }
    checked(await db.from("nbc_tickets").insert({ id, member_id: actor.id, title, body: text })); return;
  }
  if (body.action === "ticketStatus") {
    if (body.status !== "open" && body.status !== "resolved") throw new MemberError(400, "Choose a valid ticket status.");
    const ticket = checked(await db.from("nbc_tickets").select("id").eq("id", memberId(body.id)).eq("member_id", subject.id).maybeSingle());
    if (!ticket) throw new MemberError(404, "Ticket not found.");
    checked(await db.from("nbc_tickets").update({ status: body.status }).eq("id", ticket.id).eq("member_id", subject.id)); return;
  }
  if (body.action === "grant") {
    if (actor.role !== "admin") throw new MemberError(403, "Only an administrator can add credits.");
    checked(await db.rpc("nbc_credit_apply", { p_action: "grant", p_member: subject.id, p_operation: memberId(body.id), p_amount: memberCredits(body.amount), p_reason: memberText(body.reason, "credit reason", 160), p_actor: actor.id })); return;
  }
  throw new MemberError(400, "Unknown workspace action.");
}
