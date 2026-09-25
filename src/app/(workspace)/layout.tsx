import type { ReactNode } from "react";
import { PlatformShell } from "@/components/platform/PlatformShell";

export default function WorkspaceLayout({ children }: { children: ReactNode }): ReactNode {
  return <PlatformShell>{children}</PlatformShell>;
}
