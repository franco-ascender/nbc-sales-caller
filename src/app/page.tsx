import type { ReactNode } from "react";
import { PlatformShell } from "@/components/platform/PlatformShell";
import { PlatformHome } from "@/components/platform/PlatformHome";

export default function Home(): ReactNode {
  return <PlatformShell><PlatformHome /></PlatformShell>;
}
