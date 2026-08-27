"use client";

import { motion, useScroll, useTransform, AnimatePresence } from "framer-motion";
import { useRef, useState, useEffect } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  ShieldCheck, ArrowRight, Menu, X, Sparkles, Check, Star, Lock, Globe, Mail,
  Zap, Bot, Bell, ChevronDown, Truck, Boxes, ShoppingCart, Users, Package,
  Warehouse, Wallet, TrendingUp, BarChart3, MessageSquare, Phone, Send,
  Webhook, Factory, ClipboardList, Receipt, Undo2, UserPlus, KanbanSquare,
  MessagesSquare, Calculator, ClipboardCheck, UserCog, LayoutDashboard,
  ShoppingBag, Store, Wrench, ArrowUpRight, ArrowDownRight, KeyRound, FileLock,
  UserX, EyeOff, Gauge, MessageCircle, Facebook, CreditCard, Smartphone,
} from "lucide-react";

import { DashboardPreview } from "@/components/site/DashboardPreview";
import { StatsBar } from "@/components/site/StatsBar";
import { FeatureGrid } from "@/components/site/FeatureCard";
import { IntegrationGrid } from "@/components/site/IntegrationCard";
import { TestimonialGrid } from "@/components/site/TestimonialCard";
import { FAQAccordion } from "@/components/site/FAQAccordion";
import { PricingCards } from "@/components/site/PricingCards";
import { CTASection } from "@/components/site/CTASection";
import { Section, SectionHeader } from "@/components/site/Section";
import { SiteFooter } from "@/components/site/SiteFooter";
import {
  HERO_PILLS, BENTO_FEATURES, WORKFLOW_STEPS, MODULES, USE_CASES,
  COMPARISON, SECURITY_FEATURES, KANBAN_PREVIEW, ANALYTICS_PREVIEW,
  FAQS, NAV_LINKS,
} from "@/lib/site-content";
import * as LucideIconsForLanding from "lucide-react";

// Marquee items (logos/text of supported integrations & features)
const MARQUEE_ITEMS = [
  "WooCommerce", "WhatsApp Business", "Meta / Facebook", "Instagram",
  "Telegram Bot", "Pathao", "Steadfast", "RedX",
  "bKash", "Nagad", "Cash Register", "Stock Ledger", "Profit & Loss",
  "Multi-Warehouse", "Barcode Ready", "Audit Logs", "Automation Engine",
];

// ─── Animation presets ───
const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-80px" },
  transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] as const },
};

export function LandingPage() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: containerRef, offset: ["start start", "end start"] });
  const heroY = useTransform(scrollYProgress, [0, 1], [0, 80]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Lock body scroll while the mobile menu is open, and let Escape close it.
  useEffect(() => {
    if (!mobileOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [mobileOpen]);

  return (
    <div ref={containerRef} className="min-h-screen flex flex-col bg-background app-bg overflow-x-hidden">
      {/* Skip link for keyboard & screen-reader users */}
      <a href="#main-content" className="skip-link">Skip to main content</a>

      {/* Scroll progress bar */}
      <ScrollProgress />

      {/* ─── NAVBAR ─── */}
      <motion.nav
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4 }}
        className={cn(
          "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
          scrolled ? "glass shadow-sm border-b border-border/30" : "bg-transparent",
        )}
      >
        <div className="max-w-7xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-primary-foreground shadow-glow">
              <ShieldCheck className="h-[18px] w-[18px]" />
            </div>
            <span className="font-bold text-lg gradient-text">Z-CRM</span>
          </Link>
          <div className="hidden md:flex items-center gap-7">
            {NAV_LINKS.map((l) => (
              <Link key={l.href} href={l.href} className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                {l.label}
              </Link>
            ))}
          </div>
          <div className="hidden md:flex items-center gap-3">
            <Link href="/app" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Sign in</Link>
            <Link href="/register" className="inline-flex items-center gap-1.5 text-sm font-semibold bg-primary text-primary-foreground px-4 py-2 rounded-lg shadow-soft hover:bg-primary/90 transition-colors">
              Get Started <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <button
            className="md:hidden p-2 -mr-2"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav-menu"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
        {mobileOpen && (
          <div id="mobile-nav-menu" className="md:hidden border-t border-border/20 bg-card px-4 py-4 space-y-3">
            {NAV_LINKS.map((l) => (
              <Link key={l.href} href={l.href} className="block text-sm font-medium py-1" onClick={() => setMobileOpen(false)}>{l.label}</Link>
            ))}
            <div className="pt-3 border-t border-border/20 flex flex-col gap-2">
              <Link href="/app" className="text-sm font-medium py-2 text-center border border-border rounded-lg">Sign in</Link>
              <Link href="/register" className="text-sm font-semibold py-2 text-center bg-primary text-primary-foreground rounded-lg">Get Started</Link>
            </div>
          </div>
        )}
      </motion.nav>

      {/* ─── 1. HERO + DASHBOARD PREVIEW ─── */}
      <motion.section
        id="main-content"
        style={{ y: heroY, opacity: heroOpacity }}
        className="relative pt-32 pb-16 px-4 md:px-6 overflow-hidden min-h-[92vh] flex flex-col justify-center"
      >
        {/* Ambient gradient orbs */}
        <div className="absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute top-1/4 left-1/4 h-96 w-96 rounded-full bg-primary/15 blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 h-96 w-96 rounded-full bg-cyan-500/10 blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[600px] w-[600px] rounded-full bg-emerald-500/5 blur-3xl" />
        </div>

        <div className="max-w-7xl mx-auto w-full">
          <div className="text-center max-w-4xl mx-auto mb-10">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-medium text-primary mb-6"
            >
              <Sparkles className="h-3 w-3" />
              Omnichannel Business Suite for Bangladesh
              <span className="text-muted-foreground/70">·</span>
              Starting at ৳500/week
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-5"
            >
              Run your entire<br className="hidden sm:inline" /> <span className="gradient-text">business from one place.</span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-8"
            >
              Orders, inventory, customers, payments, profit & loss, WhatsApp, Facebook, WooCommerce & Telegram — unified into one CRM built for Bangladesh businesses.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-8"
            >
              <Link href="/register" className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-xl font-semibold shadow-soft hover:bg-primary/90 transition-colors">
                Start Free Trial <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/features" className="inline-flex items-center gap-2 border border-border bg-card px-6 py-3 rounded-xl font-medium hover:bg-accent transition-colors">
                Explore Features
              </Link>
            </motion.div>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="flex flex-wrap items-center justify-center gap-2"
            >
              {HERO_PILLS.map((pill) => (
                <span key={pill} className="inline-flex items-center gap-1 rounded-full bg-muted/60 border border-border/40 px-2.5 py-1 text-[11px] text-muted-foreground">
                  <Check className="h-2.5 w-2.5 text-primary" /> {pill}
                </span>
              ))}
            </motion.div>
          </div>

          {/* Dashboard preview */}
          <div className="max-w-5xl mx-auto">
            <DashboardPreview />
          </div>
        </div>
      </motion.section>

      {/* ─── Marquee ─── */}
      <Marquee />

      {/* ─── 2. TRUSTED BY / BUSINESS METRICS ─── */}
      <StatsBar />

      {/* ─── 3. EVERYTHING YOU NEED ─── */}
      <Section id="features">
        <SectionHeader
          eyebrow="Everything you need"
          title="One system for your whole business"
          description="Z-CRM replaces the spreadsheets, browser tabs, and notebook apps that hold your business together. Every module shares the same data, the same accounting engine, and the same audit trail."
        />
        <FeatureGrid features={BENTO_FEATURES} columns={4} />
      </Section>

      {/* ─── 4. PRODUCT OVERVIEW ─── */}
      <Section className="bg-muted/5 border-y border-border/20">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <motion.div {...fadeUp}>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 border border-primary/20 px-3 py-1 text-xs font-medium text-primary mb-4">
              Product Overview
            </div>
            <h2 className="text-2xl md:text-4xl font-bold tracking-tight mb-4">
              Built around a stock-movement ledger
            </h2>
            <p className="text-muted-foreground leading-relaxed mb-6">
              Most CRMs track stock as a number that goes up and down. Z-CRM records every movement in an immutable ledger — PURCHASE, SALE, RETURN, DAMAGE, ADJUSTMENT, TRANSFER, RESERVATION, RELEASE. The ledger is the single source of truth: every report, every notification, and every P&L figure derives from it.
            </p>
            <div className="space-y-3">
              {[
                "Reserved vs available buckets — never oversell",
                "Multi-warehouse with transfer approval workflow",
                "Stock count reconciliation with audit trail",
                "Historical COGS snapshots — immutable profitability",
              ].map((item) => (
                <div key={item} className="flex items-start gap-2.5">
                  <div className="h-5 w-5 rounded-full bg-primary/15 flex items-center justify-center shrink-0 mt-0.5">
                    <Check className="h-3 w-3 text-primary" />
                  </div>
                  <span className="text-sm">{item}</span>
                </div>
              ))}
            </div>
            <Link href="/product/inventory-management" className="inline-flex items-center gap-1 text-sm font-medium text-primary mt-6 hover:underline">
              Explore the inventory module <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </motion.div>
          <motion.div {...fadeUp} className="relative">
            <div className="rounded-2xl border border-border/40 bg-card p-5 shadow-pop">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-sm">Stock Movements</h3>
                <span className="text-[10px] text-muted-foreground">Last 7 days</span>
              </div>
              <div className="space-y-2">
                {[
                  { type: "PURCHASE", qty: "+100", product: "Bluetooth Speaker", color: "text-emerald-600" },
                  { type: "SALE", qty: "-2", product: "ORD-001052", color: "text-rose-600" },
                  { type: "RESERVATION", qty: "+1", product: "ORD-001051", color: "text-amber-600" },
                  { type: "RELEASE", qty: "-1", product: "ORD-001049 (cancelled)", color: "text-cyan-600" },
                  { type: "TRANSFER_OUT", qty: "-50", product: "→ Warehouse B", color: "text-violet-600" },
                  { type: "DAMAGE", qty: "-3", product: "Damaged in transit", color: "text-rose-600" },
                ].map((m, i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg border border-border/40 bg-background/50 px-3 py-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[10px] font-mono font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{m.type}</span>
                      <span className="text-xs truncate">{m.product}</span>
                    </div>
                    <span className={cn("text-xs font-bold tabular-nums", m.color)}>{m.qty}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </Section>

      {/* ─── 5. COMPLETE BUSINESS WORKFLOW ─── */}
      <Section>
        <SectionHeader
          eyebrow="Complete workflow"
          title="From supplier to profit — one continuous flow"
          description="Every step of your business is connected. Stock reserved at order creation is converted to a sale on delivery. Every payment updates the P&L. Every return adjusts inventory and audit log together."
        />
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {WORKFLOW_STEPS.map((step, i) => (
            <motion.div
              key={step.step}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
              className="relative rounded-xl border border-border/60 bg-card p-4"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-mono font-semibold text-primary">{step.step}</span>
                <ArrowRight className="h-3 w-3 text-muted-foreground/40 hidden md:block" />
              </div>
              <h3 className="font-semibold text-sm mb-1">{step.title}</h3>
              <p className="text-[11px] text-muted-foreground leading-relaxed">{step.description}</p>
            </motion.div>
          ))}
        </div>
      </Section>

      {/* ─── 6. CRM MODULES SHOWCASE ─── */}
      <Section className="bg-muted/5 border-y border-border/20">
        <SectionHeader
          eyebrow="18 modules, one database"
          title="Every module you need, built in"
          description="Each module shares the same customer, product, and order data. No more exporting CSVs from one app to import into another."
        />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {MODULES.map((m, i) => {
            const Icon = (LucideIconsForLanding as any)[m.icon] || ShoppingCart;
            return (
              <motion.div
                key={m.name}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.4, delay: (i % 6) * 0.04, ease: [0.16, 1, 0.3, 1] }}
              >
                <Link
                  href={m.href}
                  className="block rounded-xl border border-border/60 bg-card p-4 card-hover h-full"
                >
                  <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-2">
                    <Icon className="h-4 w-4" />
                  </div>
                  <h3 className="text-sm font-semibold mb-1">{m.name}</h3>
                  <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">{m.description}</p>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </Section>

      {/* ─── 7. KANBAN & SMART WORKFLOW ─── */}
      <Section>
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <motion.div {...fadeUp} className="order-2 lg:order-1">
            <div className="rounded-2xl border border-border/40 bg-card p-4 shadow-soft overflow-x-auto">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-sm">{KANBAN_PREVIEW.title}</h3>
                <div className="flex gap-1">
                  <button className="text-[10px] px-2 py-1 rounded-md bg-primary text-primary-foreground">Kanban</button>
                  <button className="text-[10px] px-2 py-1 rounded-md border border-border">List</button>
                </div>
              </div>
              <div className="flex gap-2 min-w-max">
                {KANBAN_PREVIEW.columns.map((col) => (
                  <div key={col.id} className="w-44 shrink-0">
                    <div className="flex items-center justify-between mb-2 px-1">
                      <div className="flex items-center gap-1.5">
                        <span className={cn("h-2 w-2 rounded-full", col.color)} />
                        <span className="text-xs font-semibold">{col.id}</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground bg-muted rounded-full px-1.5">{col.items.length}</span>
                    </div>
                    <div className="space-y-2 rounded-xl border border-border/40 bg-muted/20 p-2 min-h-[100px]">
                      {col.items.map((item, idx) => (
                        <motion.div
                          key={idx}
                          initial={{ opacity: 0, y: 6 }}
                          whileInView={{ opacity: 1, y: 0 }}
                          viewport={{ once: true }}
                          transition={{ duration: 0.3, delay: idx * 0.05 }}
                          className="rounded-lg border border-border/40 bg-card p-2 cursor-grab active:cursor-grabbing"
                        >
                          <p className="text-xs font-medium truncate">{item.name}</p>
                          <p className="text-xs text-primary font-semibold mt-0.5">{item.value}</p>
                        </motion.div>
                      ))}
                      {col.items.length === 0 && (
                        <div className="text-center text-[10px] text-muted-foreground/40 py-4">Drop here</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
          <motion.div {...fadeUp} className="order-1 lg:order-2">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 border border-primary/20 px-3 py-1 text-xs font-medium text-primary mb-4">
              Kanban & Smart Workflow
            </div>
            <h2 className="text-2xl md:text-4xl font-bold tracking-tight mb-4">
              Drag-and-drop workflows with built-in rules
            </h2>
            <p className="text-muted-foreground leading-relaxed mb-6">
              Visual kanban boards for orders, leads, and the sales pipeline. Drag deals between stages — the backend enforces the workflow, so a PENDING order can't be dragged to DELIVERED in one move. Same data as the list view, just visual.
            </p>
            <div className="space-y-3">
              {[
                "Orders kanban — 8 status columns with DnD",
                "Leads kanban — 6 stages from NEW to CONVERTED",
                "Sales pipeline kanban — 7 stages with pipeline value",
                "Backend rejects invalid transitions — workflow stays clean",
              ].map((item) => (
                <div key={item} className="flex items-start gap-2.5">
                  <div className="h-5 w-5 rounded-full bg-primary/15 flex items-center justify-center shrink-0 mt-0.5">
                    <Check className="h-3 w-3 text-primary" />
                  </div>
                  <span className="text-sm">{item}</span>
                </div>
              ))}
            </div>
            <Link href="/product/kanban" className="inline-flex items-center gap-1 text-sm font-medium text-primary mt-6 hover:underline">
              Explore Kanban <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </motion.div>
        </div>
      </Section>

      {/* ─── 8. AUTOMATION & NOTIFICATIONS ─── */}
      <Section className="bg-muted/5 border-y border-border/20">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <motion.div {...fadeUp}>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 border border-primary/20 px-3 py-1 text-xs font-medium text-primary mb-4">
              Automation & Notifications
            </div>
            <h2 className="text-2xl md:text-4xl font-bold tracking-tight mb-4">
              Build no-code workflows that run themselves
            </h2>
            <p className="text-muted-foreground leading-relaxed mb-6">
              Define rules that fire on business events. Send WhatsApp confirmations when an order is placed. Route low-stock alerts to the warehouse Telegram group. Auto-assign new leads to the right salesperson. All non-blocking — automation never slows your transaction.
            </p>
            <div className="space-y-3 mb-6">
              {[
                { event: "ORDER_CREATED", action: "Send WhatsApp confirmation template" },
                { event: "LOW_STOCK", action: "Notify warehouse Telegram group" },
                { event: "PAYMENT_RECEIVED", action: "Create in-app + Telegram notification" },
                { event: "NEW_LEAD", action: "Assign to salesperson + send welcome" },
              ].map((r) => (
                <div key={r.event} className="flex items-center gap-3 rounded-lg border border-border/40 bg-card px-3 py-2">
                  <span className="text-[10px] font-mono font-semibold text-primary bg-primary/10 px-2 py-1 rounded">{r.event}</span>
                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">{r.action}</span>
                </div>
              ))}
            </div>
            <Link href="/product/automation" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
              Explore the automation engine <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </motion.div>
          <motion.div {...fadeUp} className="space-y-3">
            {/* Mock notification card */}
            <div className="rounded-xl border border-border/40 bg-card p-4 shadow-soft">
              <div className="flex items-start gap-3">
                <div className="h-9 w-9 rounded-lg bg-emerald-500/15 text-emerald-600 flex items-center justify-center shrink-0">
                  <Bell className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <p className="text-sm font-semibold">New order received</p>
                    <span className="text-[10px] text-muted-foreground">just now</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Order ORD-001052 from Karim Hassan · ৳1,890 · WhatsApp</p>
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 shadow-soft">
              <div className="flex items-start gap-3">
                <div className="h-9 w-9 rounded-lg bg-amber-500/15 text-amber-600 flex items-center justify-center shrink-0">
                  <Boxes className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <p className="text-sm font-semibold">Low stock alert</p>
                    <span className="text-[10px] text-muted-foreground">3 min ago</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Bluetooth Speaker (SPK-004): 12 available. Suggested reorder: 30 units.</p>
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/5 p-4 shadow-soft">
              <div className="flex items-start gap-3">
                <div className="h-9 w-9 rounded-lg bg-cyan-500/15 text-cyan-600 flex items-center justify-center shrink-0">
                  <Send className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <p className="text-sm font-semibold">Telegram alert routed</p>
                    <span className="text-[10px] text-muted-foreground">5 min ago</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Routed to "Z-CRM Sales" Telegram group — 4 members notified.</p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </Section>

      {/* ─── 9. INTEGRATIONS ─── */}
      <Section id="integrations">
        <SectionHeader
          eyebrow="Integrations"
          title="Connect every channel you sell on"
          description="WooCommerce, WhatsApp, Facebook, Instagram, Telegram, Pathao, Steadfast, RedX, bKash, Nagad — all integrated. With HMAC-signed webhooks and idempotent processing."
        />
        <IntegrationGrid />
        <div className="text-center mt-8">
          <Link href="/integrations" className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
            View all integrations <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </Section>

      {/* ─── 10. ANALYTICS & REPORTS ─── */}
      <Section className="bg-muted/5 border-y border-border/20">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <motion.div {...fadeUp} className="order-2 lg:order-1">
            <div className="rounded-2xl border border-border/40 bg-card p-5 shadow-soft">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-sm">Monthly Performance</h3>
                <div className="flex gap-2">
                  <span className="flex items-center gap-1 text-[10px]"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Sales</span>
                  <span className="flex items-center gap-1 text-[10px]"><span className="h-2 w-2 rounded-full bg-rose-500" /> Expenses</span>
                </div>
              </div>
              <div className="h-48 flex items-end justify-between gap-2">
                {ANALYTICS_PREVIEW.map((d, i) => (
                  <motion.div
                    key={d.month}
                    initial={{ height: 0 }}
                    whileInView={{ height: `${(d.sales / 600000) * 100}%` }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6, delay: i * 0.06, ease: [0.16, 1, 0.3, 1] }}
                    className="flex-1 flex flex-col justify-end gap-1"
                  >
                    <div className="bg-gradient-to-t from-primary to-primary/60 rounded-t-md" style={{ height: `${(d.sales / 600000) * 100}%` }} />
                    <div className="bg-gradient-to-t from-rose-500 to-rose-400/60 rounded-b-md" style={{ height: `${(d.expenses / 600000) * 100}%` }} />
                    <span className="text-[9px] text-muted-foreground text-center mt-1">{d.month}</span>
                  </motion.div>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-border/20">
                <div>
                  <p className="text-[10px] text-muted-foreground">Revenue</p>
                  <p className="text-sm font-bold tabular-nums">৳32.4L</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground">Expenses</p>
                  <p className="text-sm font-bold tabular-nums">৳14.9L</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground">Net Profit</p>
                  <p className="text-sm font-bold tabular-nums text-emerald-600">৳17.5L</p>
                </div>
              </div>
            </div>
          </motion.div>
          <motion.div {...fadeUp} className="order-1 lg:order-2">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 border border-primary/20 px-3 py-1 text-xs font-medium text-primary mb-4">
              Analytics & Reports
            </div>
            <h2 className="text-2xl md:text-4xl font-bold tracking-tight mb-4">
              11 report types — all using one formula
            </h2>
            <p className="text-muted-foreground leading-relaxed mb-6">
              Every report calls the same accounting engine. The dashboard, P&L, top products, channel analytics, and per-order profit all agree — because they all derive from the same historical COGS snapshots and the same Decimal-based money math.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {["Sales", "Payments", "Expenses", "Inventory", "Products", "Customers", "Channels", "Cash Flow", "Suppliers", "Dues", "P&L"].map((r) => (
                <div key={r} className="flex items-center gap-2 rounded-lg border border-border/40 bg-card px-3 py-2">
                  <BarChart3 className="h-3.5 w-3.5 text-primary" />
                  <span className="text-xs">{r}</span>
                </div>
              ))}
            </div>
            <Link href="/product/reports-analytics" className="inline-flex items-center gap-1 text-sm font-medium text-primary mt-6 hover:underline">
              Explore reports <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </motion.div>
        </div>
      </Section>

      {/* ─── 11. SECURITY & USER PERMISSIONS ─── */}
      <Section>
        <SectionHeader
          eyebrow="Security & Permissions"
          title="Enterprise-grade security for every business"
          description="HMAC-signed sessions, PBKDF2-600k password hashing, 60+ granular permissions, immutable audit logs, and signed webhooks on every integration. Security is not an add-on — it's built in."
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {SECURITY_FEATURES.map((s, i) => {
            const Icon = (LucideIconsForLanding as any)[s.icon] || ShieldCheck;
            return (
              <motion.div
                key={s.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.4, delay: (i % 4) * 0.05 }}
                className="rounded-xl border border-border/60 bg-card p-4 card-hover"
              >
                <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-2">
                  <Icon className="h-4 w-4" />
                </div>
                <h3 className="text-sm font-semibold mb-1">{s.title}</h3>
                <p className="text-[11px] text-muted-foreground leading-relaxed">{s.description}</p>
              </motion.div>
            );
          })}
        </div>
      </Section>

      {/* ─── 12. BUSINESS USE CASES ─── */}
      <Section className="bg-muted/5 border-y border-border/20">
        <SectionHeader
          eyebrow="Use cases"
          title="Built for every kind of Bangladesh business"
          description="Whether you sell online, in-store, wholesale, or run a service business — Z-CRM adapts to your workflow."
        />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {USE_CASES.map((uc, i) => {
            const Icon = (LucideIconsForLanding as any)[uc.icon] || ShoppingBag;
            return (
              <motion.div
                key={uc.key}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.5, delay: (i % 3) * 0.06, ease: [0.16, 1, 0.3, 1] }}
              >
                <Link
                  href={uc.href}
                  className="block rounded-2xl border border-border/60 bg-card p-5 card-hover h-full"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                      <Icon className="h-5 w-5" />
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <h3 className="font-semibold text-base mb-1">{uc.name}</h3>
                  <p className="text-xs text-muted-foreground mb-3">{uc.tagline}</p>
                  <p className="text-xs text-muted-foreground/80 leading-relaxed mb-4">{uc.description}</p>
                  <div className="grid grid-cols-3 gap-2 pt-3 border-t border-border/40">
                    {uc.stats.map((stat) => (
                      <div key={stat.label}>
                        <p className="text-xs font-bold text-primary">{stat.value}</p>
                        <p className="text-[10px] text-muted-foreground">{stat.label}</p>
                      </div>
                    ))}
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </Section>

      {/* ─── 13. WHY Z-CRM / COMPETITOR COMPARISON ─── */}
      <Section>
        <SectionHeader
          eyebrow="Why Z-CRM"
          title="The CRM that takes Bangladesh seriously"
          description="We built Z-CRM because every other CRM expects you to be in San Francisco. We support bKash, Nagad, Pathao, Steadfast, RedX, and Bangla — out of the box."
        />
        <div className="max-w-4xl mx-auto rounded-2xl border border-border/60 bg-card overflow-hidden">
          <div className="grid grid-cols-[1fr_auto_auto] gap-4 px-5 py-3 border-b border-border/40 bg-muted/30">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Feature</span>
            <span className="text-xs font-semibold uppercase tracking-wider text-primary w-16 text-center">Z-CRM</span>
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground w-16 text-center">Others</span>
          </div>
          {COMPARISON.map((row, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -8 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-20px" }}
              transition={{ duration: 0.3, delay: (i % 10) * 0.03 }}
              className="grid grid-cols-[1fr_auto_auto] gap-4 px-5 py-2.5 border-b border-border/20 last:border-b-0 items-center"
            >
              <span className="text-xs text-foreground/90">{row.feature}</span>
              <div className="w-16 flex justify-center">
                {row.zcrm === true ? (
                  <div className="h-5 w-5 rounded-full bg-primary/15 flex items-center justify-center">
                    <Check className="h-3 w-3 text-primary" />
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground">{row.zcrm}</span>
                )}
              </div>
              <div className="w-16 flex justify-center">
                {row.others === true ? (
                  <div className="h-5 w-5 rounded-full bg-muted flex items-center justify-center">
                    <Check className="h-3 w-3 text-muted-foreground" />
                  </div>
                ) : row.others === false ? (
                  <div className="h-5 w-5 rounded-full bg-muted flex items-center justify-center">
                    <X className="h-3 w-3 text-muted-foreground" />
                  </div>
                ) : (
                  <span className="text-xs text-amber-600">{row.others}</span>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </Section>

      {/* ─── 14. PRICING ─── */}
      <Section id="pricing" className="bg-muted/5 border-y border-border/20">
        <SectionHeader
          eyebrow="Pricing"
          title="Simple, transparent pricing"
          description="Start at ৳500/week. No annual contract required. Every plan includes a 7-day free trial — no credit card needed."
        />
        <PricingCards />
      </Section>

      {/* ─── 15. CUSTOMER TESTIMONIALS ─── */}
      <Section id="testimonials">
        <SectionHeader
          eyebrow="Testimonials"
          title="Loved by businesses across Bangladesh"
          description="From Dhaka to Sylhet, businesses use Z-CRM to run their operations end-to-end."
        />
        <TestimonialGrid />
      </Section>

      {/* ─── 16. FAQ ─── */}
      <Section id="faq" className="bg-muted/5 border-y border-border/20">
        <SectionHeader
          eyebrow="FAQ"
          title="Frequently asked questions"
          description="Everything you need to know about Z-CRM. Can't find an answer? Reach out at support@z-crm.app."
        />
        <div className="max-w-3xl mx-auto">
          <FAQAccordion items={FAQS.slice(0, 10)} />
          <div className="text-center mt-6">
            <Link href="/faq" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
              View all FAQs <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </Section>

      {/* ─── 17. FINAL CTA ─── */}
      <CTASection
        title="Ready to unify your business?"
        subtitle="Start your 7-day free trial. No credit card required. Cancel anytime."
        primaryCTA="Start Free Trial"
        primaryHref="/register"
        secondaryCTA="View Pricing"
        secondaryHref="/pricing"
      />

      {/* ─── 18. FOOTER ─── */}
      <SiteFooter />

      {/* ─── Sticky CTA bar (appears after scroll) ─── */}
      <AnimatePresence>
        {scrolled && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            className="fixed bottom-0 left-0 right-0 z-40 glass border-t border-border/30 px-4 py-3 md:py-2.5 md:flex md:items-center md:justify-between md:max-w-5xl md:mx-auto md:rounded-t-xl md:bottom-4 md:left-1/2 md:-translate-x-1/2 md:border md:border-border/40 md:shadow-pop"
          >
            <div className="flex items-center gap-2 mb-2 md:mb-0">
              <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-primary-foreground shrink-0">
                <Sparkles className="h-3.5 w-3.5" />
              </div>
              <div>
                <p className="text-xs font-semibold">Try Z-CRM Free</p>
                <p className="text-[10px] text-muted-foreground hidden md:block">No credit card · ৳500/week · Cancel anytime</p>
              </div>
            </div>
            <Link href="/register" className="block text-center bg-primary text-primary-foreground px-5 py-2 rounded-lg text-xs font-semibold shadow-soft hover:bg-primary/90 transition-colors">
              Get Started →
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Scroll progress bar at the top of the page ───
function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  return (
    <motion.div
      style={{ scaleX: scrollYProgress }}
      className="fixed top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-primary via-primary to-cyan-500 origin-left z-50"
    />
  );
}

// ─── Marquee of supported integrations and features ───
function Marquee() {
  return (
    <div className="border-y border-border/20 bg-muted/5 overflow-hidden py-4">
      <div className="flex items-center gap-8 animate-marquee">
        {[...MARQUEE_ITEMS, ...MARQUEE_ITEMS].map((item, i) => (
          <span key={i} className="text-xs font-medium text-muted-foreground whitespace-nowrap flex items-center gap-2">
            <span className="h-1 w-1 rounded-full bg-primary/40" /> {item}
          </span>
        ))}
      </div>
    </div>
  );
}
