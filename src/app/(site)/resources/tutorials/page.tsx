import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, GraduationCap, Clock, BookOpen } from "lucide-react";
import { PageHero } from "@/components/site/PageHero";
import { Section, SectionHeader } from "@/components/site/Section";
import { CTASection } from "@/components/site/CTASection";
import { IconByName } from "@/components/site/FeatureCard";

export const metadata: Metadata = {
  title: "Tutorials — Step-by-step guides for every Z-CRM workflow",
  description:
    "Hands-on tutorials covering getting started, orders, inventory, integrations, automation, and reports. Each tutorial includes screenshots and worked examples.",
  alternates: { canonical: "https://z-crm.app/resources/tutorials" },
};

const TUTORIAL_CATEGORIES = [
  {
    icon: "Rocket",
    title: "Getting Started",
    tone: "emerald",
    count: 6,
    duration: "~45 min total",
    description: "From sign-up to your first fulfilled order. The fastest path to value.",
    tutorials: [
      "Sign up and complete the first-run checklist",
      "Invite your team and assign roles",
      "Create your first product and category",
      "Create your first order",
      "Record a payment and reconcile the cash register",
      "Export your first report",
    ],
  },
  {
    icon: "ShoppingCart",
    title: "Orders",
    tone: "blue",
    count: 8,
    duration: "~90 min total",
    description: "Every order workflow — from quick entry to returns and refunds.",
    tutorials: [
      "Quick order creation (under 30 seconds)",
      "Bulk order entry with line-item discounts",
      "Order status workflow and Kanban DnD",
      "Accepting bKash and Nagad payments",
      "Processing customer returns (good and damaged)",
      "Issuing full and partial refunds",
      "Cash-on-delivery with courier tracking",
      "Customer credit limits at checkout",
    ],
  },
  {
    icon: "Boxes",
    title: "Inventory",
    tone: "amber",
    count: 7,
    duration: "~70 min total",
    description: "Ledger-based stock, multi-warehouse, transfers, and reconciliation.",
    tutorials: [
      "Setting up warehouses",
      "Per-warehouse stock levels and reorder alerts",
      "Stock transfers with approval workflow",
      "Running a stock count and reconciliation",
      "Managing damaged stock separately from sellable",
      "Product variants and barcodes",
      "Low-stock notifications and suggested reorder qty",
    ],
  },
  {
    icon: "Plug",
    title: "Integrations",
    tone: "violet",
    count: 9,
    duration: "~120 min total",
    description: "Connect every channel and payment method you sell on.",
    tutorials: [
      "Connecting WooCommerce with HMAC-signed webhooks",
      "Setting up WhatsApp Business Cloud API",
      "Verifying WhatsApp webhook signatures",
      "Meta Lead Ads auto-import",
      "Omnichannel inbox (WhatsApp + Messenger + Instagram)",
      "Courier integration: Pathao, Steadfast, RedX",
      "bKash and Nagad payment setup",
      "Telegram bot: per-group RBAC",
      "Idempotent webhook processing",
    ],
  },
  {
    icon: "Zap",
    title: "Automation",
    tone: "teal",
    count: 5,
    duration: "~60 min total",
    description: "Build no-code workflows that respond to events in real time.",
    tutorials: [
      "Your first automation rule (ORDER_CREATED → WhatsApp)",
      "Event → rule → action workflow",
      "WhatsApp template notifications",
      "Notification routing to Telegram groups",
      "Non-blocking trigger execution",
    ],
  },
  {
    icon: "BarChart3",
    title: "Reports",
    tone: "cyan",
    count: 6,
    duration: "~75 min total",
    description: "11 report types with CSV export. Real-time P&L and analytics.",
    tutorials: [
      "P&L report with historical COGS snapshots",
      "Sales report by channel and date range",
      "Inventory report: valuation and movement",
      "Customer report: top spenders and lifetime value",
      "Cash flow report (inflows and outflows)",
      "CSV export with formula-injection protection",
    ],
  },
];

const TONE_CLASSES: Record<string, { bg: string; text: string }> = {
  emerald: { bg: "bg-emerald-500/10", text: "text-emerald-600 dark:text-emerald-400" },
  teal: { bg: "bg-teal-500/10", text: "text-teal-600 dark:text-teal-400" },
  cyan: { bg: "bg-cyan-500/10", text: "text-cyan-600 dark:text-cyan-400" },
  violet: { bg: "bg-violet-500/10", text: "text-violet-600 dark:text-violet-400" },
  amber: { bg: "bg-amber-500/10", text: "text-amber-600 dark:text-amber-400" },
  blue: { bg: "bg-blue-500/10", text: "text-blue-600 dark:text-blue-400" },
};

export default function TutorialsPage() {
  return (
    <>
      <PageHero
        eyebrow="Tutorials"
        title="Step-by-step guides for every Z-CRM workflow"
        description="Hands-on tutorials with screenshots and worked examples. From your first order to multi-warehouse stock reconciliation — start anywhere."
        breadcrumbs={[{ label: "Resources" }, { label: "Tutorials" }]}
      />

      {/* Overview stats */}
      <Section className="pt-0">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { icon: "BookOpen", label: "Tutorials", value: "41+" },
            { icon: "Clock", label: "Total duration", value: "~8 hrs" },
            { icon: "GraduationCap", label: "Categories", value: "6" },
            { icon: "Sparkles", label: "Last updated", value: "Weekly" },
          ].map((stat) => (
            <div key={stat.label} className="rounded-2xl border border-border/60 bg-card p-4 text-center">
              <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center mx-auto mb-2">
                <IconByName name={stat.icon} className="h-4 w-4" />
              </div>
              <div className="text-xl font-bold tracking-tight">{stat.value}</div>
              <div className="text-[11px] text-muted-foreground">{stat.label}</div>
            </div>
          ))}
        </div>
      </Section>

      {/* Tutorial categories */}
      <Section className="pt-0">
        <SectionHeader
          eyebrow="Browse by category"
          title="Pick a category and start learning"
          description="Each tutorial is a self-contained walkthrough — you can complete them in any order."
          align="left"
        />
        <div className="space-y-4 mt-6">
          {TUTORIAL_CATEGORIES.map((cat) => {
            const tone = TONE_CLASSES[cat.tone] || TONE_CLASSES.emerald;
            const anchor = `#${cat.title.toLowerCase().replace(/\s+/g, "-")}`;
            return (
              <div
                key={cat.title}
                id={cat.title.toLowerCase().replace(/\s+/g, "-")}
                className="rounded-2xl border border-border/60 bg-card overflow-hidden"
              >
                <div className="grid grid-cols-1 md:grid-cols-3">
                  {/* Header column */}
                  <div className="md:col-span-1 p-5 md:p-6 border-b md:border-b-0 md:border-r border-border/40 bg-muted/20">
                    <div className="flex items-start gap-3">
                      <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${tone.bg} ${tone.text}`}>
                        <IconByName name={cat.icon} className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-sm">{cat.title}</h3>
                        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{cat.description}</p>
                        <div className="flex flex-wrap items-center gap-2 mt-3">
                          <span className="text-[10px] font-medium text-muted-foreground bg-muted/60 rounded-full px-2 py-0.5">
                            {cat.count} tutorials
                          </span>
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground bg-muted/60 rounded-full px-2 py-0.5">
                            <Clock className="h-2.5 w-2.5" /> {cat.duration}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* Tutorials list */}
                  <div className="md:col-span-2 p-5 md:p-6">
                    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {cat.tutorials.map((tut, i) => (
                        <li key={tut}>
                          <Link
                            href={`/resources/tutorials${anchor}`}
                            className="group flex items-start gap-2 rounded-lg p-2 -mx-2 hover:bg-accent transition-colors"
                          >
                            <span className="text-[10px] font-semibold text-muted-foreground bg-muted/50 rounded-md px-1.5 py-0.5 shrink-0 mt-0.5">
                              {String(i + 1).padStart(2, "0")}
                            </span>
                            <span className="text-xs font-medium group-hover:text-primary transition-colors">{tut}</span>
                            <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0 mt-1 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Section>

      {/* Coming next */}
      <Section className="bg-muted/5 border-y border-border/20">
        <div className="max-w-2xl mx-auto text-center">
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-2xl bg-primary/10 text-primary mb-4">
            <GraduationCap className="h-6 w-6" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight mb-3">Want a tutorial we don&apos;t have?</h2>
          <p className="text-muted-foreground mb-6 leading-relaxed">
            We publish new tutorials every week based on what customers ask for. Tell us what you&apos;d like to learn
            and we&apos;ll prioritize it.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-xl font-semibold shadow-soft hover:bg-primary/90 transition-colors"
            >
              Request a tutorial <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/resources/docs"
              className="inline-flex items-center gap-2 border border-border bg-card px-5 py-2.5 rounded-xl font-medium hover:bg-accent transition-colors"
            >
              Read the docs
            </Link>
          </div>
        </div>
      </Section>

      <CTASection
        title="Put your tutorials into practice"
        subtitle="Start your 7-day free trial. No credit card required."
        secondaryCTA="View pricing"
        secondaryHref="/pricing"
      />
    </>
  );
}
