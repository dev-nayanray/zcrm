"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { ShieldCheck, Menu, X, ChevronDown } from "lucide-react";
import { NAV_LINKS, PRODUCT_PAGES, INTEGRATIONS, USE_CASES } from "@/lib/site-content";

// Site header with mega-menu dropdowns for Products, Integrations, Use Cases.
// Always solid (unlike the landing page nav which is transparent at the top).
export function SiteHeader() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  const megaMenus: { label: string; sections: { title: string; items: { name: string; href: string; description?: string }[] }[] }[] = [
    {
      label: "Product",
      sections: [
        {
          title: "Core CRM",
          items: PRODUCT_PAGES.slice(0, 6).map((p) => ({ name: p.name, href: `/product/${p.slug}`, description: p.tagline })),
        },
        {
          title: "Operations",
          items: PRODUCT_PAGES.slice(6, 12).map((p) => ({ name: p.name, href: `/product/${p.slug}`, description: p.tagline })),
        },
        {
          title: "System",
          items: PRODUCT_PAGES.slice(12).map((p) => ({ name: p.name, href: `/product/${p.slug}`, description: p.tagline })),
        },
      ],
    },
    {
      label: "Integrations",
      sections: [
        {
          title: "Channels",
          items: INTEGRATIONS.slice(0, 5).map((i) => ({ name: i.name, href: i.href, description: i.category })),
        },
        {
          title: "Payments & Logistics",
          items: INTEGRATIONS.slice(5).map((i) => ({ name: i.name, href: i.href, description: i.category })),
        },
      ],
    },
    {
      label: "Use Cases",
      sections: [
        {
          title: "By Business Type",
          items: USE_CASES.map((u) => ({ name: u.name, href: u.href, description: u.tagline })),
        },
      ],
    },
  ];

  return (
    <header className={cn(
      "sticky top-0 z-50 w-full transition-all duration-300",
      scrolled ? "glass shadow-soft border-b border-border/30" : "bg-background/80 backdrop-blur-sm border-b border-border/20",
    )}>
      <nav className="max-w-7xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 shrink-0">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-primary-foreground shadow-glow">
            <ShieldCheck className="h-[18px] w-[18px]" />
          </div>
          <span className="font-bold text-lg gradient-text">Z-CRM</span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden lg:flex items-center gap-1">
          {/* Mega-menu items */}
          {megaMenus.map((menu) => (
            <div
              key={menu.label}
              className="relative"
              onMouseEnter={() => setOpenDropdown(menu.label)}
              onMouseLeave={() => setOpenDropdown(null)}
            >
              <button
                className={cn(
                  "flex items-center gap-1 px-3 py-2 text-sm font-medium rounded-md transition-colors",
                  isActive(`/${menu.label.toLowerCase()}`) ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {menu.label}
                <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", openDropdown === menu.label && "rotate-180")} />
              </button>
              {openDropdown === menu.label && (
                <div className="absolute left-0 top-full pt-2 w-[560px]">
                  <div className="rounded-2xl border border-border/40 bg-card shadow-pop p-4 grid grid-cols-2 gap-4">
                    {menu.sections.map((section) => (
                      <div key={section.title}>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 mb-2 px-2">{section.title}</p>
                        <div className="space-y-0.5">
                          {section.items.map((item) => (
                            <Link
                              key={item.href}
                              href={item.href}
                              className="block px-2 py-1.5 rounded-md hover:bg-accent transition-colors"
                            >
                              <p className="text-sm font-medium">{item.name}</p>
                              {item.description && (
                                <p className="text-[11px] text-muted-foreground truncate">{item.description}</p>
                              )}
                            </Link>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
          <Link href="/pricing" className={cn("px-3 py-2 text-sm font-medium rounded-md transition-colors", isActive("/pricing") ? "text-primary" : "text-muted-foreground hover:text-foreground")}>
            Pricing
          </Link>
          <Link href="/resources/docs" className={cn("px-3 py-2 text-sm font-medium rounded-md transition-colors", isActive("/resources") ? "text-primary" : "text-muted-foreground hover:text-foreground")}>
            Resources
          </Link>
          <Link href="/about" className={cn("px-3 py-2 text-sm font-medium rounded-md transition-colors", isActive("/about") ? "text-primary" : "text-muted-foreground hover:text-foreground")}>
            About
          </Link>
        </div>

        {/* Right side: CTAs */}
        <div className="hidden lg:flex items-center gap-2 shrink-0">
          <Link href="/app" className="text-sm font-medium text-muted-foreground hover:text-foreground px-3 py-2 rounded-md transition-colors">
            Sign in
          </Link>
          <Link
            href="/register"
            className="text-sm font-semibold bg-primary text-primary-foreground px-4 py-2 rounded-lg shadow-soft hover:bg-primary/90 transition-colors"
          >
            Start Free Trial
          </Link>
        </div>

        {/* Mobile menu button */}
        <button
          className="lg:hidden p-2 rounded-md hover:bg-accent transition-colors"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </nav>

      {/* Mobile menu — keyed by pathname so it auto-closes on route change
          (avoids setting state during render or in an effect). */}
      {mobileOpen && (
        <div key={`mobile-menu-${pathname}`} className="lg:hidden border-t border-border/20 bg-card max-h-[80vh] overflow-y-auto">
          <div className="px-4 py-4 space-y-4">
            <Link href="/features" className="block text-sm font-medium py-2">Features</Link>
            <Link href="/pricing" className="block text-sm font-medium py-2">Pricing</Link>
            <details className="group">
              <summary className="flex items-center justify-between text-sm font-medium py-2 cursor-pointer">
                Product
                <ChevronDown className="h-3.5 w-3.5 group-open:rotate-180 transition-transform" />
              </summary>
              <div className="pl-4 mt-2 space-y-1 max-h-72 overflow-y-auto">
                {PRODUCT_PAGES.map((p) => (
                  <Link key={p.slug} href={`/product/${p.slug}`} className="block text-xs text-muted-foreground hover:text-foreground py-1">
                    {p.name}
                  </Link>
                ))}
              </div>
            </details>
            <details className="group">
              <summary className="flex items-center justify-between text-sm font-medium py-2 cursor-pointer">
                Integrations
                <ChevronDown className="h-3.5 w-3.5 group-open:rotate-180 transition-transform" />
              </summary>
              <div className="pl-4 mt-2 space-y-1">
                {INTEGRATIONS.map((i) => (
                  <Link key={i.key} href={i.href} className="block text-xs text-muted-foreground hover:text-foreground py-1">
                    {i.name}
                  </Link>
                ))}
              </div>
            </details>
            <details className="group">
              <summary className="flex items-center justify-between text-sm font-medium py-2 cursor-pointer">
                Use Cases
                <ChevronDown className="h-3.5 w-3.5 group-open:rotate-180 transition-transform" />
              </summary>
              <div className="pl-4 mt-2 space-y-1">
                {USE_CASES.map((u) => (
                  <Link key={u.key} href={u.href} className="block text-xs text-muted-foreground hover:text-foreground py-1">
                    {u.name}
                  </Link>
                ))}
              </div>
            </details>
            <Link href="/about" className="block text-sm font-medium py-2">About</Link>
            <Link href="/contact" className="block text-sm font-medium py-2">Contact</Link>
            <Link href="/faq" className="block text-sm font-medium py-2">FAQ</Link>
            <div className="pt-3 border-t border-border/20 flex flex-col gap-2">
              <Link href="/app" className="text-sm font-medium py-2 text-center border border-border rounded-lg">Sign in</Link>
              <Link href="/register" className="text-sm font-semibold py-2 text-center bg-primary text-primary-foreground rounded-lg">Start Free Trial</Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
