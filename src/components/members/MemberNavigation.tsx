"use client";
import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useWorkspaceAccess } from "@/components/workspace/WorkspaceAccess";
import type { MemberSummary } from "@/lib/member-types";

const Context = createContext<MemberSummary | null>(null);
export const useMemberNavigation = (): MemberSummary | null => useContext(Context);
export function MemberNavigation({ children }: { children: ReactNode }): ReactNode {
  const { token } = useWorkspaceAccess(); const pathname = usePathname();
  const [state, setState] = useState<{ token: string; data: MemberSummary } | null>(null);
  useEffect(() => {
    if (!token) return;
    let active = true; let request = 0;
    const controller = new AbortController();
    async function refresh(): Promise<void> {
      const version = ++request;
      try {
        const response = await fetch("/api/members/summary", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error("Summary unavailable");
        const data = await response.json() as MemberSummary;
        if (active && version === request) setState({ token, data });
      } catch { if (active && version === request) setState(null); }
    }
    const update = (): void => { void refresh(); };
    update(); window.addEventListener("nbc-members-updated", update); window.addEventListener("focus", update);
    return () => { active = false; controller.abort(); window.removeEventListener("nbc-members-updated", update); window.removeEventListener("focus", update); };
  }, [token, pathname]);
  return <Context.Provider value={state?.token === token ? state.data : null}>{children}</Context.Provider>;
}
