import { validSessionId } from "./caller-validation.ts";

export interface SessionCursor { createdAt: string; id: string }
export interface SessionPageOptions { limit: number; cursor: SessionCursor | null }

// Preserve microseconds: converting Postgres timestamps to Date would skip tied rows.
export function validCursorDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|\+00:00)$/.test(value)) return false;
  const time = Date.parse(value);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 19) === value.slice(0, 19);
}

export function encodeSessionCursor(session: { created_at: string; id: string }): string {
  return Buffer.from(JSON.stringify({ v: 1, createdAt: session.created_at, id: session.id })).toString("base64url");
}

export function parseSessionPage(cursor: unknown, limit: unknown, maximum = 30): SessionPageOptions {
  const parsedLimit = limit === undefined || limit === null ? maximum : typeof limit === "string" && /^[1-9]\d*$/.test(limit) ? Number(limit) : limit;
  if (typeof parsedLimit !== "number" || !Number.isInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > maximum) throw new Error(`Use a limit between 1 and ${maximum}.`);
  if (cursor === undefined || cursor === null) return { limit: parsedLimit, cursor: null };
  if (typeof cursor !== "string" || cursor.length > 512 || !/^[A-Za-z0-9_-]+$/.test(cursor)) throw new Error("Invalid history cursor. Refresh the history and try again.");
  try {
    const decoded: unknown = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
    if (!decoded || typeof decoded !== "object" || !("v" in decoded) || decoded.v !== 1 || !("createdAt" in decoded) || !validCursorDate(decoded.createdAt) || !("id" in decoded) || !validSessionId(decoded.id)) throw new Error();
    return { limit: parsedLimit, cursor: { createdAt: decoded.createdAt, id: decoded.id.toLowerCase() } };
  } catch { throw new Error("Invalid history cursor. Refresh the history and try again."); }
}

export function sessionCursorFilter(cursor: SessionCursor): string {
  // Both interpolated values are validated before this reaches PostgREST.
  return `created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`;
}
