"use client";

import Link from "next/link";
import { ShieldCheck, Lock, Globe, Mail } from "lucide-react";
import { FOOTER_COLUMNS, SITE } from "@/lib/site-content";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-border/20 bg-muted/5">
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-12">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-8 mb-8">
          {/* Brand column */}
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="flex items-center gap-2 mb-3">
              <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-primary-foreground">
                <ShieldCheck className="h-3.5 w-3.5" />
              </div>
              <span className="font-bold gradient-text">Z-CRM</span>
            </Link>
            <p className="text-xs text-muted-foreground max-w-xs mb-4">
              Omnichannel Business Suite — the complete CRM for Bangladesh.
            </p>
            <a href={`mailto:${SITE.email}`} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
              <Mail className="h-3 w-3" />
              {SITE.email}
            </a>
          </div>
          {/* Link columns */}
          {FOOTER_COLUMNS.map((col) => (
            <div key={col.title}>
              <p className="text-xs font-semibold mb-3 uppercase tracking-wider">{col.title}</p>
              <ul className="space-y-2">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="pt-6 border-t border-border/20 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
          <p>© {new Date().getFullYear()} Z-CRM · Built for Bangladesh 🇧🇩</p>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1"><Lock className="h-3 w-3" /> Secure</span>
            <span className="flex items-center gap-1"><Globe className="h-3 w-3" /> EN / বাংলা</span>
            <Link href="/legal/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
            <Link href="/legal/terms" className="hover:text-foreground transition-colors">Terms</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
