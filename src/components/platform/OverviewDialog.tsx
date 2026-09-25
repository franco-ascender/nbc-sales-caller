"use client";
import { useEffect, useId, useRef } from 'react';
import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import styles from './PlatformHome.module.css';
export function OverviewDialog({ title, subtitle, onClose, children }: { title: string; subtitle?: string; onClose(): void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null), id = useId();
  useEffect(() => { const opener = document.activeElement as HTMLElement | null; ref.current?.showModal(); return () => { opener?.focus(); }; }, []);
  return <dialog ref={ref} className={styles.dialog} aria-labelledby={id} onCancel={event => { event.preventDefault(); onClose(); }} onClick={event => { if (event.target === ref.current) { const r = ref.current.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) onClose(); } }}><header className={styles.dialogHead}><div><span className={styles.eyebrow}>MAKE IT YOURS</span><h2 id={id}>{title}</h2>{subtitle && <p>{subtitle}</p>}</div><button onClick={onClose} className={styles.iconButton} aria-label="Close dialog"><X size={21} /></button></header>{children}</dialog>;
}
