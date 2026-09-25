"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { X } from "lucide-react";
import { Integrations } from "@/components/dashboard/Integrations";
import styles from "../Workspace.module.css";

export function IntegrationsWorkspace(): ReactNode {
  const [message, setMessage] = useState("");
  return <><header className={styles.heading}><p className={styles.eyebrow}>NBC SALES / INTEGRATIONS</p><h1>Everything, connected.</h1><p>Configure and test your GoHighLevel connection. Real records require your operator account; configuration alone does not verify a connection.</p></header>{message && <div className={styles.notice} role="status">{message}<button aria-label="Dismiss notification" onClick={() => setMessage("")}><X size={16} /></button></div>}<Integrations notify={setMessage} /></>;
}
