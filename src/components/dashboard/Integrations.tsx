"use client";

import { useEffect, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { createClient } from "@supabase/supabase-js";
import { ArrowRight, Check, CheckCircle2, Cloud, ExternalLink, KeyRound, Loader2, LockKeyhole, Plug, RefreshCw, ShieldCheck, Zap } from "lucide-react";
import type { ContactCheck, IntegrationEvent, IntegrationStatus } from "./Dashboard.types";
import common from "./Dashboard.module.css";
import styles from "./Integrations.module.css";

async function requestJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...options, cache: "no-store", signal: AbortSignal.timeout(15000) });
  const payload = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(payload.error ?? "The request could not be completed.");
  return payload;
}

export function Integrations({ notify }: { notify: (message: string) => void }): ReactNode {
  const [status, setStatus] = useState<IntegrationStatus | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [token, setToken] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [contactId, setContactId] = useState("");
  const [contact, setContact] = useState<ContactCheck | null>(null);
  const [events, setEvents] = useState<IntegrationEvent[] | null>(null);
  const [tab, setTab] = useState<"setup" | "test">("setup");
  const [checkedAt, setCheckedAt] = useState("");

  async function refreshStatus(): Promise<void> {
    setBusy("status"); setError("");
    try { setStatus(await requestJson<IntegrationStatus>("/api/integrations/status")); }
    catch { setError("We couldn't check the connection setup. Please try again."); }
    finally { setBusy(""); }
  }
  useEffect(() => { void refreshStatus(); }, []);

  async function login(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault(); setBusy("login"); setError("");
    try {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
      if (!url || !key) throw new Error("Operator access hasn't been configured yet.");
      const auth = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
      const { data, error: authError } = await auth.auth.signInWithPassword({ email, password });
      if (authError || !data.session) throw new Error("Couldn't sign in. Check the test operator's email and password.");
      const response = await requestJson<{ events: IntegrationEvent[] }>("/api/integrations/events", { headers: { Authorization: `Bearer ${data.session.access_token}` } });
      setToken(data.session.access_token); setEvents(response.events); setPassword(""); setCheckedAt(new Date().toISOString());
      notify("Signed in to the real test workspace.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Sign-in could not be completed."); }
    finally { setBusy(""); }
  }

  async function testContact(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault(); setBusy("contact"); setError(""); setContact(null);
    try {
      const result = await requestJson<{ contact: ContactCheck }>("/api/integrations/ghl/test", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ contactId: contactId.trim() }) });
      setContact(result.contact); notify("Contact verified in GoHighLevel.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "The contact could not be verified."); }
    finally { setBusy(""); }
  }

  async function refreshEvents(): Promise<void> {
    setBusy("events"); setError("");
    try { const result = await requestJson<{ events: IntegrationEvent[] }>("/api/integrations/events", { headers: { Authorization: `Bearer ${token}` } }); setEvents(result.events); setCheckedAt(new Date().toISOString()); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "The event history could not be loaded."); }
    finally { setBusy(""); }
  }

  const readyCount = status ? [status.ghl, status.auth, status.storage, status.webhook].filter(Boolean).length : 0;
  return <div>
    <div className={styles.tabs}><button className={tab === "setup" ? styles.activeTab : ""} onClick={() => setTab("setup")}>Connections</button><button className={tab === "test" ? styles.activeTab : ""} onClick={() => setTab("test")}>Test workspace <span>LIVE DATA</span></button></div>
    {error && <div className={styles.error} role="alert">{error}<button onClick={() => setError("")}>Dismiss</button></div>}
    {tab === "setup" ? <>
      <div className={styles.integrationGrid}>
        <section className={`${common.card} ${styles.connectionCard}`}><div className={styles.connectionTop}><span className={styles.ghlLogo}><Zap size={25} fill="currentColor" /></span><span className={styles.state}>{status ? status.ghl ? "Configured · Not verified" : "Not connected" : "Checking setup…"}</span></div><h2>GoHighLevel</h2><p>Your leads and calendar, connected to every conversation. Start with a dedicated test sub-account.</p><div className={styles.tags}><span>Contacts</span><span>Workflows</span><span>Calendar · Next step</span></div><footer><span><ShieldCheck size={14} />Credentials stay private</span><button className={common.primaryButton} onClick={() => setTab("test")}>Set up & test <ArrowRight size={14} /></button></footer></section>
        <section className={`${common.card} ${styles.connectionCard}`}><div className={styles.connectionTop}><span className={styles.voiceLogo}><Plug size={24} /></span><span className={styles.state}>Not connected</span></div><h2>Voice & telephony</h2><p>The right voice makes all the difference. Choose your provider after comparing quality and response time.</p><div className={styles.tags}><span>Anas's voice</span><span>Inbound leads</span><span>Human handoff</span></div><footer><span>Provider selection is still open</span><span className={styles.comingSoon}>Next milestone</span></footer></section>
        <section className={`${common.card} ${styles.connectionCard}`}><div className={styles.connectionTop}><span className={styles.voiceLogo}><Plug size={24} /></span><span className={styles.state}>Not connected</span></div><h2>Meta Ads</h2><p>Ad spend and campaign attribution for the Master Dashboard tracker. Requires a Meta Marketing API app.</p><div className={styles.tags}><span>Ad spend</span><span>Campaign attribution</span><span>Tracker · Next step</span></div><footer><span>Needs META_ACCESS_TOKEN, META_AD_ACCOUNT_ID</span><span className={styles.comingSoon}>Waiting on Meta app</span></footer></section>
        <section className={`${common.card} ${styles.connectionCard}`}><div className={styles.connectionTop}><span className={styles.voiceLogo}><Plug size={24} /></span><span className={styles.state}>Not connected</span></div><h2>Stripe (client revenue)</h2><p>Cash collected for a client's own account, for the Master Dashboard tracker. Separate from NBC's own Credits billing Stripe key.</p><div className={styles.tags}><span>Cash collected</span><span>Client account</span><span>Tracker · Next step</span></div><footer><span>Needs TRACKER_STRIPE_SECRET_KEY</span><span className={styles.comingSoon}>Waiting on client access</span></footer></section>
      </div>
      <section className={`${common.card} ${styles.readiness}`}><div className={common.cardHeading}><div><h2>A clear path to your first test.</h2><p>Setup status reflects server configuration, not a verified connection.</p></div><span className={styles.progressLabel}>{readyCount} of 4 configured</span></div><div className={styles.steps}>{[{ ready: status?.ghl, title: "Connect a test sub-account", text: "GoHighLevel location and private integration credentials." }, { ready: status?.auth, title: "Set up operator access", text: "Sign in securely to view real integration data." }, { ready: status?.storage, title: "Prepare event storage", text: "Keep a persistent record of incoming test events." }, { ready: status?.webhook, title: "Connect your workflow", text: "An authenticated event sent from GoHighLevel." }].map((step, i) => <div key={step.title}><span className={`${styles.stepNumber} ${step.ready ? styles.stepComplete : ""}`}>{step.ready ? <Check size={15} /> : `0${i + 1}`}</span><strong>{step.title}</strong><p>{step.text}</p></div>)}</div><div className={styles.readinessFooter}><a href="https://help.gohighlevel.com/support/solutions/articles/155000003054-private-integrations-everything-you-need-to-know" target="_blank" rel="noreferrer">GoHighLevel setup guide <ExternalLink size={13} /></a><button className={common.textButton} onClick={() => void refreshStatus()} disabled={Boolean(busy)}><RefreshCw size={13} className={busy === "status" ? styles.spin : ""} />Recheck setup</button></div></section>
    </> : <div className={styles.testLayout}>
      <section className={common.card}><div className={common.cardHeading}><div><h2>{token ? "Your test connection" : "Open your test workspace"}</h2><p>Real integration checks are separate from the demo dashboard.</p></div><LockKeyhole size={20} /></div>
        {!token ? <div className={styles.loginBody}><div className={styles.lockIllustration}><KeyRound size={30} /></div><h3>A small step before the first hello.</h3><p>Sign in with the test operator account configured for NBC. Your account gives you access to real contacts and received events.</p>{status && !status.auth && <div className={styles.setupNeeded}>Operator access is not configured yet. Follow the local setup guide to connect your Supabase project.</div>}<form onSubmit={event => void login(event)} className={styles.form}><label>Work email<input type="email" autoComplete="username" required value={email} onChange={event => setEmail(event.target.value)} placeholder="you@company.com" /></label><label>Password<input type="password" autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} placeholder="Your test operator password" /></label><button className={common.primaryButton} disabled={!status?.auth || Boolean(busy)}>{busy === "login" ? <Loader2 size={15} className={styles.spin} /> : <LockKeyhole size={15} />}Sign in to test workspace</button></form></div> : <div className={styles.loginBody}><span className={styles.signedIn}><CheckCircle2 size={15} />Signed in as {email}</span><form onSubmit={event => void testContact(event)} className={styles.form}><label>Test contact ID<input value={contactId} onChange={event => setContactId(event.target.value)} required maxLength={100} pattern="[a-zA-Z0-9_-]+" placeholder="Contact ID from your test sub-account" /></label><p>Reads one contact and verifies that it belongs to your configured sub-account. No calls or messages are sent.</p><button className={common.primaryButton} disabled={!status?.ghl || Boolean(busy)}>{busy === "contact" ? <Loader2 size={15} className={styles.spin} /> : <Plug size={15} />}Verify contact</button></form>{contact && <div className={styles.success} role="status"><CheckCircle2 size={19} /><div><strong>{contact.name} verified</strong><p>{contact.id}</p><small>Checked {new Date(contact.checkedAt).toLocaleString()}</small></div></div>}<button className={styles.signOut} onClick={() => { setToken(""); setEvents(null); setContact(null); setPassword(""); setError(""); }}>Sign out of test workspace</button></div>}
      </section>
      <section className={common.card}><div className={common.cardHeading}><div><h2>Incoming events</h2><p>Real workflow events received from GoHighLevel.</p></div><button className={common.iconButton} aria-label="Refresh incoming events" disabled={!token || Boolean(busy)} onClick={() => void refreshEvents()}><RefreshCw size={17} className={busy === "events" ? styles.spin : ""} /></button></div>{!token ? <div className={styles.eventsEmpty}><LockKeyhole size={28} /><h3>Your events stay yours.</h3><p>Sign in to see received events from the test workspace.</p></div> : !events?.length ? <div className={styles.eventsEmpty}><Cloud size={32} /><h3>{status?.ghl ? "Ready for the first event." : "Your workspace is ready."}</h3><p>{status?.ghl ? "Run your GoHighLevel test workflow, then refresh this panel." : "Connect your GoHighLevel test sub-account to start receiving events."}</p></div> : <div className={styles.eventList}>{events.map(event => <article key={event.id}><span><Check size={13} /></span><div><strong>{event.event_type}</strong><p>{event.contact_id}</p><small>{new Date(event.received_at).toLocaleString()}</small></div><span className={styles.received}>Received</span></article>)}</div>}{checkedAt && token && <p className={styles.lastChecked}>Last checked {new Date(checkedAt).toLocaleTimeString()} · Latest 25 events</p>}</section>
    </div>}
  </div>;
}
