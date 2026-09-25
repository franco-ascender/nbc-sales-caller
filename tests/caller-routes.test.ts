import "./caller-test-loader.mjs";
import assert from "node:assert/strict";
import test from "node:test";
import type { CallSession } from "../src/lib/caller-types.ts";
// Dynamic imports run through the test loader; requireCallerUser and Supabase SDK are REAL.
const routes = await import("../src/app/api/caller/sessions/route.ts");
const reconcile = await import("../src/app/api/caller/sessions/reconcile/route.ts");
const sync = await import("../src/app/api/caller/sessions/[id]/sync/route.ts");
const { encodeSessionCursor } = await import("../src/lib/caller-pagination.ts");
type Row = CallSession & { operator_id: string; provider_agent_id: string };
const operator = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";
const id = (n: number): string => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const row = (n: number, extra: Partial<Row> = {}): Row => ({ id: id(n), operator_id: operator, provider_agent_id: "fixture-agent", provider: "elevenlabs", provider_call_id: `fixture-call-${n}`, channel: "web", status: "processing", created_at: "2026-09-14T10:00:00.123456+00:00", started_at: null, ended_at: null, synced_at: null, duration_seconds: null, transcript: [], summary: null, failure_code: null, ...extra });
function request(path = "", body?: object, auth: string | null = "allowed"): Request {
  return new Request(`http://fixture.test/api/caller/sessions${path}`, { method: body ? "POST" : "GET", headers: { ...(auth ? { Authorization: `Bearer ${auth}` } : {}), ...(body ? { "Content-Type": "application/json" } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
}
const payload = (n: number, status = "done"): object => ({ agent_id: "fixture-agent", conversation_id: `fixture-call-${n}`, status, transcript: [{ role: "user", message: "C01 fixture transcript", time_in_call_secs: 1 }], metadata: { call_duration_secs: 12, start_time_unix_secs: 1789380000 } });

test("real Caller routes, auth, persistence and adapter with isolated HTTP fixtures", async t => {
  const originalFetch = globalThis.fetch;
  const names = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "SUPABASE_SECRET_KEY", "NBC_OPERATOR_EMAIL", "ELEVENLABS_API_KEY", "ELEVENLABS_AGENT_ID"];
  const previous = names.map(name => process.env[name]);
  const values = ["https://caller-fixture.supabase.co", "fixture-public", "fixture-server", "operator@example.test", "fixture-provider", "fixture-agent"];
  names.forEach((name, i) => { process.env[name] = values[i]; });
  let rows: Row[] = [];
  let providerReads: string[] = [];
  let databaseReads = 0;
  let provider: (n: number) => Promise<Response> = async n => Response.json(payload(n));
  let beforePatch: (() => void) | null = null;
  globalThis.fetch = async (input, init) => {
    const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
    if (url.pathname === "/auth/v1/user") {
      if (headers.get("authorization") === "Bearer invalid") return Response.json({ message: "Invalid token" }, { status: 401 });
      return Response.json({ id: operator, email: headers.get("authorization") === "Bearer allowed" ? "operator@example.test" : "other@example.test", email_confirmed_at: headers.get("authorization") === "Bearer unconfirmed" ? null : "2026-09-14T00:00:00Z" });
    }
    if (url.pathname === "/rest/v1/nbc_members") return Response.json([]);
    if (url.hostname === "api.elevenlabs.io") {
      providerReads.push(url.pathname);
      assert.match(url.pathname, /^\/v1\/convai\/conversations\/fixture-call-\d+$/); // creation is forbidden
      return provider(Number(url.pathname.split("-").at(-1)));
    }
    if(url.pathname==="/rest/v1/rpc/nbc_usage_record"){const usage=JSON.parse(String(init?.body));assert.equal(usage.p_member,operator);assert.equal(usage.p_source,'caller');assert.match(usage.p_key,/^[0-9a-f-]{36}$/);return Response.json(id(999));}
    assert.equal(url.hostname, "caller-fixture.supabase.co");
    assert.equal(url.pathname, "/rest/v1/call_sessions");
    assert.equal(url.searchParams.get("operator_id"), `eq.${operator}`); // fails if production loses isolation
    databaseReads++;
    if (init?.method === "PATCH" && beforePatch) { const hook = beforePatch; beforePatch = null; hook(); }
    let found = rows.filter(item => item.operator_id === operator);
    for (const field of ["id", "status", "synced_at"] as const) {
      const filter = url.searchParams.get(field);
      if (filter?.startsWith("eq.")) found = found.filter(item => item[field] === filter.slice(3));
      if (filter === "is.null") found = found.filter(item => item[field] === null);
      if (filter?.startsWith("in.(")) found = found.filter(item => filter.slice(4, -1).split(",").includes(String(item[field])));
    }
    const cursor = url.searchParams.get("or");
    if (cursor) {
      const match = cursor.match(/^\(created_at.lt.([^,]+),and\(created_at.eq.([^,]+),id.lt.([^)]+)\)\)$/);
      assert.ok(match, `Unexpected cursor filter ${cursor}`);
      assert.equal(match[1], match[2]);
      found = found.filter(item => item.created_at < match[1] || item.created_at === match[1] && item.id < match[3]);
    }
    if (init?.method === "PATCH") {
      const patch = JSON.parse(String(init.body)) as Partial<Row>;
      found.forEach(item => Object.assign(item, patch));
    } else {
      assert.ok(!init?.method || init.method === "GET", "No inserts during reconciliation");
      if (url.searchParams.has("order")) {
        assert.equal(url.searchParams.get("order"), "created_at.desc,id.desc");
        found.sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id));
      }
      if (url.searchParams.has("limit")) found = found.slice(0, Number(url.searchParams.get("limit")));
    }
    const fields = url.searchParams.get("select")?.split(",") ?? [];
    const projected = found.map(item => Object.fromEntries(fields.map(field => [field, item[field as keyof Row]])));
    return Response.json(projected);
  };
  try {
    await t.test("reject anonymous, invalid token, wrong email and unconfirmed users through actual requireCallerUser", async () => {
      for (const auth of [null, "invalid", "wrong", "unconfirmed"]) {
        const before = databaseReads;
        for (const response of [await routes.GET(request("", undefined, auth)), await reconcile.POST(request("/reconcile", {}, auth)), await sync.POST(request("/x/sync", {}, auth), { params: Promise.resolve({ id: id(1) }) })]) {
          assert.equal(response.status, auth === "wrong" ? 403 : 401);
          assert.equal(response.headers.get("cache-control"), "no-store");
        }
        assert.equal(databaseReads, before);
      }
    });
    await t.test("validate cursor/limits at route boundary; wrong-owner sync stays private", async () => {
      for (const path of ["?cursor=bad", "?limit=31", "?limit=0", "?limit=1&limit=2", "?cursor="]) assert.equal((await routes.GET(request(path))).status, 400);
      for (const body of [{ limit: 6 }, { limit: "2" }, { cursor: "bad" }, { sessionIds: [id(1)] }]) assert.equal((await reconcile.POST(request("/reconcile", body))).status, 400);
      rows = [row(1, { operator_id: other })];
      assert.equal((await sync.POST(request("/x/sync", {}), { params: Promise.resolve({ id: id(1) }) })).status, 404);
      assert.equal(providerReads.length, 0);
    });
    await t.test("successive pages with tied timestamps, microseconds, new insertion and a foreign cursor", async () => {
      rows = Array.from({ length: 65 }, (_, i) => row(i + 1));
      rows.push(row(90, { operator_id: other }));
      const first = await (await routes.GET(request())).json();
      assert.equal(first.sessions.length, 30); assert.equal(first.configured, true);
      assert.equal(first.sessions[0].id, id(65));
      assert.ok(!("operator_id" in first.sessions[0]));
      rows.push(row(100, { created_at: "2026-09-14T10:00:00.123457+00:00" }));
      const second = await (await routes.GET(request(`?cursor=${first.nextCursor}`))).json();
      const third = await (await routes.GET(request(`?cursor=${second.nextCursor}`))).json();
      const ids = [...first.sessions, ...second.sessions, ...third.sessions].map((item: CallSession) => item.id);
      assert.equal(ids.length, 65); assert.equal(new Set(ids).size, 65); assert.equal(third.nextCursor, null);
      const foreignCursor = encodeSessionCursor(row(90));
      const own = await (await routes.GET(request(`?cursor=${foreignCursor}`))).json();
      assert.ok(own.sessions.every((item: CallSession) => item.id !== id(90)));
      const micro = await (await routes.GET(request("?limit=1"))).json();
      const next = await (await routes.GET(request(`?limit=1&cursor=${micro.nextCursor}`))).json();
      assert.equal(next.sessions[0].id, id(65));
    });
    await t.test("five-session partial recovery, continuation, temporary 404 and no voice creation", async () => {
      rows = [row(1), row(2), row(3, { created_at: new Date().toISOString() }), row(4), row(5), row(6), row(7, { operator_id: other }), row(8, { status: "completed" })];
      providerReads = [];
      provider = async n => n === 2 ? Response.json({ private: "provider secret" }, { status: 500 }) : n === 3 || n === 4 ? Response.json({}, { status: 404 }) : Response.json(payload(n, n === 5 ? "processing" : "done"));
      const response = await reconcile.POST(request("/reconcile", {}));
      assert.equal(response.status, 200);
      const batch = await response.json();
      assert.equal(batch.results.length, 5); assert.equal(providerReads.length, 5);
      assert.equal(batch.results.find((item: { sessionId: string }) => item.sessionId === id(2)).outcome, "retry");
      assert.equal(batch.results.find((item: { sessionId: string }) => item.sessionId === id(3)).outcome, "pending");
      assert.equal(batch.results.find((item: { sessionId: string }) => item.sessionId === id(4)).outcome, "expired");
      assert.equal(batch.results.find((item: { sessionId: string }) => item.sessionId === id(5)).outcome, "pending");
      assert.equal(batch.results.find((item: { sessionId: string }) => item.sessionId === id(6)).outcome, "completed");
      assert.ok(!JSON.stringify(batch).includes("provider secret"));
      const rest = await (await reconcile.POST(request("/reconcile", { cursor: batch.nextCursor }))).json();
      assert.deepEqual(rest.results.map((item: { sessionId: string }) => item.sessionId), [id(1)]);
      assert.equal(rest.nextCursor, null);
    });
    await t.test("expired/no-conversation handling, verified text retention and final races", async () => {
      rows = [row(1, { provider_call_id: null }), row(2, { status: "expired" }), row(3, { transcript: [{ role: "user", message: "Verified fixture", time_in_call_secs: 1 }], synced_at: "2026-09-14T10:00:01Z" })];
      provider = async n => Response.json({ ...payload(n, "processing"), transcript: [] });
      const run = async (n: number) => (await sync.POST(request("/x/sync", {}), { params: Promise.resolve({ id: id(n) }) })).json();
      assert.equal((await run(1)).session.status, "expired");
      assert.equal((await run(2)).session.status, "expired");
      assert.equal((await run(3)).session.transcript[0].message, "Verified fixture");
      beforePatch = () => { Object.assign(rows[2], { status: "completed", summary: "Won concurrent race", synced_at: new Date().toISOString() }); };
      assert.equal((await run(3)).session.summary, "Won concurrent race");
      const reads = providerReads.length;
      assert.equal((await run(3)).session.status, "completed");
      assert.equal(providerReads.length, reads);
      provider = async n => Response.json(payload(n));
      assert.equal((await run(2)).session.status, "completed");
      rows = [row(10)];
      provider = async () => Response.json({ ...payload(10), agent_id: "wrong-agent" });
      assert.equal((await sync.POST(request("/x/sync", {}), { params: Promise.resolve({ id: id(10) }) })).status, 502);
      assert.equal(rows[0].status, "processing");
    });
  } finally {
    globalThis.fetch = originalFetch;
    names.forEach((name, i) => { if (previous[i] === undefined) delete process.env[name]; else process.env[name] = previous[i]; });
  }
});
