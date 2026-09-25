"use client";
import { createContext, useContext, useEffect, useMemo, useRef, useState, useCallback } from "react";
import type { FormEvent, ReactNode } from "react";
import { createClient } from "@supabase/supabase-js";
import type { Session } from "@supabase/supabase-js";
import { WORKSPACE_SESSION_KEY, WorkspaceSessionStorage } from "@/lib/workspace-session-storage";
import { ArrowUpRight, AudioLines, LockKeyhole, Sparkles } from "lucide-react";
import type { WorkspaceIdentity } from "@/lib/workspace-types";
import styles from "./WorkspaceAccess.module.css";

interface Access { token: string; user: WorkspaceIdentity | null; signOut(): Promise<void> }
const Context = createContext<Access>({ token: "", user: null, signOut: async () => undefined });
export const useWorkspaceAccess = (): Access => useContext(Context);

export function WorkspaceAccess({ children }: { children: ReactNode }): ReactNode {
  const [token, setToken] = useState(""); const [user, setUser] = useState<WorkspaceIdentity | null>(null);
  const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const [checking, setChecking] = useState(true); const [retry, setRetry] = useState(false);
  const epoch = useRef(0); const locked = useRef(false); const ending = useRef(false); const mounted = useRef(true);
  const storage = useMemo(() => new WorkspaceSessionStorage(() => window.localStorage), []);
  const auth = useMemo(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    return typeof window !== "undefined" && url && key ? createClient(url, key, { auth: { storage, storageKey: WORKSPACE_SESSION_KEY, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } }) : null;
  }, [storage]);
  const clearAccess = useCallback((): void => {
    epoch.current++; setToken(""); setUser(null); setChecking(false); setRetry(false);
  }, []);
  const signOut = useCallback(async (): Promise<void> => {
    ending.current = true; clearAccess(); setPassword(""); setError("");
    try { await auth?.auth.signOut({ scope: "local" }); } finally { storage.clear(); ending.current = false; }
  }, [auth, storage, clearAccess]);
  const verify = useCallback(async (session: Session | null): Promise<void> => {
    if (ending.current) return;
    const version = ++epoch.current;
    setChecking(true); setRetry(false); setError("");
    try {
      // A queued INITIAL_SESSION or another tab's refresh can be older than storage.
      // Reconcile with the SDK before deciding the browser needs a new login.
      if (!session || !storage.matches(session.access_token)) {
        if (!storage.remaining()) { clearAccess(); return; }
        const current = await auth?.auth.getSession();
        if (!mounted.current || version !== epoch.current) return;
        if (current?.error) throw current.error;
        session = current?.data.session ?? null;
        if (!session || !storage.matches(session.access_token)) throw new Error("Session recovery pending");
      }
      const response = await fetch("/api/workspace/session", { headers: { Authorization: `Bearer ${session.access_token}` }, cache: "no-store", signal: AbortSignal.timeout(20000) });
      const body = await response.json() as { user?: WorkspaceIdentity; error?: string };
      if (!mounted.current || version !== epoch.current) return;
      if (!storage.matches(session.access_token)) {
        // Keep the saved session when a newer token arrived during verification.
        // Its auth event will verify it; offer recovery if that event was missed.
        if (storage.remaining()) { setUser(null); setToken(""); setRetry(true); setError("Your session was renewed. Please try again."); return; }
        clearAccess(); return;
      }
      if (!response.ok || !body.user) {
        if (response.status === 401 || response.status === 403) { await signOut(); throw new Error("Your session is no longer active. Please sign in again."); }
        throw new Error("We could not verify your session. Please try again.");
      }
      setUser(body.user); setToken(session.access_token); setPassword("");
    } catch {
      if (mounted.current && version === epoch.current) {
        setUser(null); setToken(""); setRetry(storage.remaining() > 0);
        setError("We could not verify your session. Please try again.");
      }
    } finally { if (mounted.current && version === epoch.current) setChecking(false); }
  }, [auth, storage, clearAccess, signOut]);
  const restore = useCallback(async (): Promise<void> => {
    if (!auth) { clearAccess(); return; }
    const version = epoch.current;
    setChecking(true); setError("");
    try {
      const { data, error: failure } = await auth.auth.getSession();
      if (!mounted.current || version !== epoch.current) return;
      if (failure) throw failure;
      await verify(data.session);
    } catch {
      if (mounted.current && version === epoch.current) { setChecking(false); setRetry(storage.remaining() > 0); setError("Your session could not be restored. Please try again."); }
    }
  }, [auth, clearAccess, storage, verify]);
  useEffect(() => { const refresh = (): void => { void restore(); }; window.addEventListener("nbc-profile-updated", refresh); return () => window.removeEventListener("nbc-profile-updated", refresh); }, [restore]);
  useEffect(() => {
    mounted.current = true;
    // SDK callbacks stay synchronous: work is deferred outside its auth lock.
    const listener = auth?.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") { clearAccess(); return; }
      if (!locked.current && ["INITIAL_SESSION", "SIGNED_IN", "TOKEN_REFRESHED"].includes(event)) {
        window.setTimeout(() => { if (mounted.current && !locked.current) void verify(session); }, 0);
      }
    });
    if (!auth) setChecking(false);
    const expire = (): void => { if (!storage.remaining() && !locked.current) { storage.clear(); clearAccess(); } };
    const onStorage = (event: StorageEvent): void => { if (event.key === null || event.key === WORKSPACE_SESSION_KEY) expire(); };
    const timer = window.setInterval(expire, 1000);
    window.addEventListener("storage", onStorage); window.addEventListener("focus", expire); document.addEventListener("visibilitychange", expire);
    return () => { mounted.current = false; epoch.current++; listener?.data.subscription.unsubscribe(); window.clearInterval(timer); window.removeEventListener("storage", onStorage); window.removeEventListener("focus", expire); document.removeEventListener("visibilitychange", expire); };
  }, [auth, storage, clearAccess, verify]);
  async function login(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault(); if (locked.current) return;
    locked.current = true; const version = ++epoch.current; setBusy(true); setError("");
    try {
      if (!auth) throw new Error("Workspace access is being prepared. Please try again later.");
      await auth.auth.initialize();
      storage.begin();
      const result = await auth.auth.signInWithPassword({ email, password });
      if (result.error || !result.data.session) { storage.clear(); throw new Error("Check your email and password, then try again."); }
      if (!mounted.current || version !== epoch.current) return;
      await verify(result.data.session);
    } catch (failure) {
      if (mounted.current && version === epoch.current) setError(failure instanceof Error ? failure.message : "Sign-in failed. Try again.");
    } finally { locked.current = false; if (mounted.current) setBusy(false); }
  }
  return <Context.Provider value={{ token, user, signOut }}>
    {user ? children : checking ? <main className={styles.restoring} role="status">Checking your session…</main> : <main className={styles.entry}>
      <section className={styles.story}><a className={styles.logo} href="/">NBC<span>.</span></a><span className={styles.kicker}>THE SALES OPERATING SYSTEM</span><h1>Built for the<br />next <em>conversation.</em></h1><p>Your pipeline. Your voice. Your next move.<br />One NBC workspace, built around the way you sell.</p><div className={styles.signal} aria-hidden="true">{Array.from({ length: 32 }, (_, index) => <i key={index} />)}</div><div className={styles.storyFoot}><AudioLines size={20} /><span>From first hello to the next opportunity.</span></div></section>
      <section className={styles.formSide}><div className={styles.formCard}><span className={styles.badge}><Sparkles size={15} /> YOUR NBC WORKSPACE</span><h2>Welcome back.</h2><p>Sign in to your NBC workspace.</p>{retry ? <div className={styles.recovery}><p role="alert">{error}</p><button onClick={() => void restore()}>Try again</button><button onClick={() => void signOut()}>Sign in with another account</button></div> : <form onSubmit={event => void login(event)}><label>Email address<input type="email" autoComplete="username" required value={email} onChange={event => setEmail(event.target.value)} /></label><label>Password<input type="password" autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} /></label>{error && <p className={styles.error} role="alert">{error}</p>}<button disabled={busy}>{busy ? "Opening your workspace…" : "Enter NBC Sales"}<ArrowUpRight size={19} /></button></form>}<small><LockKeyhole size={14} />Stay signed in for 12 hours on this browser.</small></div><span className={styles.signature}>BUILT FOR THE NEXT CONVERSATION.</span></section>
    </main>}
  </Context.Provider>;
}
