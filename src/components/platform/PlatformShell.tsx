"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AudioLines, ChevronRight, Layers3, LayoutGrid, Menu, ScanSearch, X, PanelLeftClose, PanelLeftOpen, Sun, Moon } from "lucide-react";
import type { PlatformShellProps } from "./Platform.types";
import styles from "./Platform.module.css";
import { useAppearance } from "./Appearance";
import { useWorkspaceAccess } from "@/components/workspace/WorkspaceAccess";

// Focused launch navigation. Other modules remain available for later reactivation.
const navigation = [
  { href: "/", title: "Overview", icon: LayoutGrid },
  { href: "/lead-engine", title: "Lead Engine", icon: ScanSearch },
  { href: "/caller", title: "Caller", icon: AudioLines },
];

export function PlatformShell({ children }: PlatformShellProps): ReactNode {
  const pathname = usePathname();
  const appearance = useAppearance();
  const access = useWorkspaceAccess();
  const [profile,setProfile]=useState<{name:string;avatarTone:string}|null>(null);
  useEffect(()=>{const c=new AbortController();const refresh=()=>{void fetch('/api/profile',{headers:{Authorization:`Bearer ${access.token}`},signal:c.signal,cache:'no-store'}).then(async r=>r.ok?r.json():null).then(p=>{if(p&&!c.signal.aborted)setProfile(p);}).catch(()=>{});};refresh();window.addEventListener('nbc-profile-updated',refresh);return()=>{c.abort();window.removeEventListener('nbc-profile-updated',refresh);};},[access.token]);

  const [menuOpen, setMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => { try { setCollapsed(localStorage.getItem(`nbc-sidebar:${access.user?.id}`) === "hidden"); } catch { /* Optional visual preference. */ } }, [access.user?.id]);
  function collapse(value: boolean): void { setCollapsed(value); try { localStorage.setItem(`nbc-sidebar:${access.user?.id}`, value ? "hidden" : "visible"); } catch { /* Navigation still works without storage. */ } }

  const navRef = useRef<HTMLElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (menuOpen) navRef.current?.querySelector<HTMLAnchorElement>("a")?.focus(); }, [menuOpen]);
  const current = navigation.find(item => item.href === pathname)?.title ?? (pathname === "/settings" ? "Settings" : pathname === "/support" ? "Support" : pathname === "/credits" ? "NBC Credits" : "NBC Sales");
  return <div className={`${styles.shell} ${styles.platformTheme} ${collapsed ? styles.sidebarCollapsed : ""}`}>
    <a href="#workspace-content" className={styles.skipLink}>Skip to content</a>
    <aside className={`${styles.sidebar} ${menuOpen ? styles.sidebarOpen : ""}`}>
      <div className={styles.brandRow}><Link href="/" className={styles.brand} onClick={() => setMenuOpen(false)}><span>NBC<span className={styles.gold}>.</span></span><small>SALES SYSTEM</small></Link><button className={styles.sidebarHide} aria-label="Hide sidebar" onClick={() => collapse(true)}><PanelLeftClose size={18} /></button></div>
      <div className={styles.workspaceIdentity}><span className={styles.workspaceIcon}><Layers3 size={18} /></span><div><strong>NBC Sales</strong><small>Your sales workspace</small></div></div>
      <p className={styles.navLabel}>YOUR WORKSPACE</p>
      <nav ref={navRef} id="platform-navigation" aria-label="Platform navigation" className={styles.nav} onKeyDown={event => { if (event.key === "Escape") { setMenuOpen(false); toggleRef.current?.focus(); } }}>
        {navigation.map(({ href, title, icon: Icon }) => <Link key={href} href={href} onClick={() => setMenuOpen(false)} aria-current={pathname === href ? "page" : undefined} className={`${styles.navLink} ${pathname === href ? styles.navActive : ""}`}><Icon size={18} /><span>{title}</span>{pathname === href && <ChevronRight size={15} />}</Link>)}
      </nav>
      <div className={styles.sidebarBottom}><div className={styles.brandNote}><span className={styles.gold}>NEVER BE CLOSING.</span><p>Your systems.<br />Your knowledge.<br />One place to grow.</p></div><div className={styles.workspaceFooter}><div className={styles.profileLink}><span className={styles.profileAvatar} data-tone={profile?.avatarTone||'blue'}>{(profile?.name||access.user?.name||'N').split(' ').map(n=>n[0]).slice(0,2).join('')}</span><span><strong>{profile?.name||access.user?.name||'NBC member'}</strong><small>Your workspace</small></span></div></div></div>
    </aside>
    <div className={styles.mainWrap}>
      <header className={styles.topbar}><div className={styles.breadcrumb}><button className={styles.desktopToggle} aria-label={collapsed ? "Show sidebar" : "Hide sidebar"} aria-expanded={!collapsed} aria-controls="platform-navigation" onClick={() => collapse(!collapsed)}>{collapsed ? <PanelLeftOpen size={19} /> : <PanelLeftClose size={19} />}</button><button ref={toggleRef} className={styles.mobileToggle} aria-label={menuOpen ? "Close platform navigation" : "Open platform navigation"} aria-expanded={menuOpen} aria-controls="platform-navigation" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X size={21} /> : <Menu size={21} />}</button><span>NBC Sales</span><ChevronRight size={13} /><strong>{current}</strong></div><div className={styles.account}><button className={styles.appearanceToggle} aria-label={appearance.appearance === "light" ? "Use dark appearance" : "Use light appearance"} title={appearance.appearance === "light" ? "Dark appearance" : "Light appearance"} onClick={appearance.toggle}>{appearance.appearance === "light" ? <Moon size={17} /> : <Sun size={17} />}</button><span><i />{profile?.name || access.user?.name || "NBC Sales"}</span><button onClick={() => void access.signOut()}>Sign out</button></div></header>
      <main id="workspace-content" className={styles.main}>{children}</main>
      <footer className={styles.footer}><span>NBC Sales · Never Be Closing</span><span>Conversations into opportunities.</span></footer>
    </div>
  </div>;
}
