"use client";
import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
type Appearance = 'light' | 'dark';
const Context = createContext<{ appearance: Appearance; toggle(): void }>({ appearance: 'light', toggle: () => undefined });
export const useAppearance = () => useContext(Context);
export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [appearance, setAppearance] = useState<Appearance>('light');
  useEffect(() => { setAppearance(document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'); const change = (e: StorageEvent) => { if (e.key === 'nbc-appearance') { const next = e.newValue === 'dark' ? 'dark' : 'light'; setAppearance(next); document.documentElement.dataset.theme = next; } }; window.addEventListener('storage',change); return () => window.removeEventListener('storage',change); },[]);
  function toggle() { const next = appearance === 'light' ? 'dark' : 'light'; setAppearance(next); document.documentElement.dataset.theme = next; try { localStorage.setItem('nbc-appearance',next); } catch { /* Appearance still changes when storage is unavailable. */ } }
  return <Context.Provider value={{appearance,toggle}}>{children}</Context.Provider>;
}
