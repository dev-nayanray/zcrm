"use client";

import { SiteHeader } from "./SiteHeader";
import { SiteFooter } from "./SiteFooter";

// Wrapper for inner public pages — applies the standard header + footer
// + a min-height flex layout so the footer sticks to the bottom on short
// pages and is pushed down naturally on long pages.
export function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-background app-bg">
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
