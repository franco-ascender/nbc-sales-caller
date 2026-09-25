import localFont from "next/font/local";
import typography from "./Typography.module.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import "@/styles/globals.css";
import "@/styles/appearance.css";
import { AppearanceProvider } from "@/components/platform/Appearance";
import { WorkspaceAccess } from "@/components/workspace/WorkspaceAccess";
import { MemberNavigation } from "@/components/members/MemberNavigation";

const bodyFont = localFont({ src: "../../public/fonts/dm-sans.woff2", variable: "--font-body", weight: "400 800", display: "swap" });
const displayFont = localFont({ src: "../../public/fonts/manrope.woff2", variable: "--font-display", weight: "400 800", display: "swap" });

export const metadata: Metadata = {
  title: "NBC Sales · Your master workspace",
  description: "The NBC Sales workspace. Caller, prospecting, Academy and the knowledge behind your sales operation.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: ReactNode }): ReactNode {
  return <html lang="en" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{ __html: `try{document.documentElement.dataset.theme=localStorage.getItem("nbc-appearance")==="dark"?"dark":"light"}catch{document.documentElement.dataset.theme="light"}` }} /></head><body className={`${bodyFont.variable} ${displayFont.variable} ${typography.body}`}><AppearanceProvider><WorkspaceAccess><MemberNavigation>{children}</MemberNavigation></WorkspaceAccess></AppearanceProvider></body></html>;
}
