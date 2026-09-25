"use client";

import type { ReactNode } from "react";
import styles from "@/components/dashboard/Dashboard.module.css";

export default function ErrorPage({ reset }: { reset: () => void }): ReactNode {
  return <main className={styles.empty}><h1>Let's try that again.</h1><p>The dashboard couldn't load this view. Your workspace data hasn't been changed.</p><button className={styles.primaryButton} onClick={reset}>Reload dashboard</button></main>;
}
