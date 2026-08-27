import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, LifeBuoy, Search } from "lucide-react";
import { PageHero } from "@/components/site/PageHero";
import { Section, SectionHeader } from "@/components/site/Section";
import { CTASection } from "@/components/site/CTASection";
import { IconByName } from "@/components/site/FeatureCard";
import { HELP_ARTICLES } from "@/lib/site-content";

export const metadata: Metadata = {
  title: "Help Center — How can we help?",
  description:
    "Search the Z-CRM help center for guides on onboarding, orders, integrations, security, inventory, finance, reports, Telegram, and users.",
  alternates: { canonical: "https://z-crm.app/resources/help" },
};

const HELP_CATEGORIES = [
  { icon: "Rocket", title: "Onboarding", count: 8, description: "Sign up, invite your team, and complete the first-run checklist.", tone: "emerald" },
  { icon: "ShoppingCart", title: "Orders", count: 14, description: "Create, search, fulfill, return, and refund orders across all channels.", tone: "blue" },
  { icon: "Plug", title: "Integrations", count: 18, description: "WooCommerce, WhatsApp, Facebook, Telegram, couriers, and payments.", tone: "violet" },
  { icon: "ShieldCheck", title: "Security", count: 9, description: "Roles, permissions, audit logs, webhooks, and password policy.", tone: "rose" },
  { icon: "Boxes", title: "Inventory", count: 11, description: "Ledger-based stock, multi-warehouse, transfers, and reconciliation.", tone: "amber" },
  { icon: "Wallet", title: "Finance", count: 10, description: "Payments, cash register, P&L, expenses, and customer credit.", tone: "emerald" },
  { icon: "BarChart3", title: "Reports", count: 12, description: "11 report types, CSV export, and dashboards.", tone: "cyan" },
  { icon: "Send", title: "Telegram", count: 7, description: "Bot commands, per-group RBAC, and notification routing.", tone: "teal" },
  { icon: "Users", title: "Users", count: 6, description: "Inviting team members, roles, and permissions.", tone: "blue" },
];

const TONE_CLASSES: Record<string, { bg: string; text: string }> = {
  emerald: { bg: "bg-emerald-500/10", text: "text-emerald-600 dark:text-emerald-400" },
  teal: { bg: "bg-teal-500/10", text: "text-teal-600 dark:text-teal-400" },
  cyan: { bg: "bg-cyan-500/10", text: "text-cyan-600 dark:text-cyan-400" },
  violet: { bg: "bg-violet-500/10", text: "text-violet-600 dark:text-violet-400" },
  amber: { bg: "bg-amber-500/10", text: "text-amber-600 dark:text-amber-400" },
  blue: { bg: "bg-blue-500/10", text: "text-blue-600 dark:text-blue-400" },
  rose: { bg: "bg-rose-500/10", text: "text-rose-600 dark:text-rose-400" },
};

export default function HelpPage() {
  return (
    <>
      <PageHero
        eyebrow="Help Center"
        title="How can we help?"
        description="Search our knowledge base, browse by category, or reach out to our support team. We respond within 24 hours on weekdays."
        breadcrumbs={[{ label: "Resources" }, { label: "Help Center" }]}
      />

      {/* Search bar (visual only) */}
      <Section className="pt-0">
        <div className="max-w-2xl mx-auto">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground pointer-events-none" />
            <input
              type="search"
              placeholder="Search for help articles, guides, or topics..."
              aria-label="Search help articles"
              className="w-full h-14 pl-12 pr-4 rounded-2xl border border-border bg-card text-sm shadow-soft focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40 transition-colors"
            />
          </div>
          <p className="text-xs text-muted-foreground mt-2 text-center">
            Try: “WooCommerce”, “cash register”, “roles and permissions”, “returns”
          </p>
        </div>
      </Section>

      {/* Categories */}
      <Section className="pt-0">
        <SectionHeader
          eyebrow="Browse by category"
          title="Pick a topic"
          description="Each category contains step-by-step guides, troubleshooting tips, and reference docs."
          align="left"
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
          {HELP_CATEGORIES.map((cat) => {
            const tone = TONE_CLASSES[cat.tone] || TONE_CLASSES.emerald;
            const anchor = `#${cat.title.toLowerCase()}`;
            return (
              <Link
                key={cat.title}
                href={`/resources/help${anchor}`}
                className="group rounded-2xl border border-border/60 bg-card p-5 card-hover"
              >
                <div className="flex items-start gap-3">
                  <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${tone.bg} ${tone.text}`}>
                    <IconByName name={cat.icon} className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-semibold text-sm group-hover:text-primary transition-colors">{cat.title}</h3>
                      <span className="text-[10px] font-medium text-muted-foreground bg-muted/50 rounded-full px-2 py-0.5 shrink-0">
                        {cat.count} articles
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed mt-1">{cat.description}</p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </Section>

      {/* Popular articles */}
      <Section className="bg-muted/5 border-y border-border/20">
        <SectionHeader
          eyebrow="Popular articles"
          title="Most-read help articles"
          description="Start here — these cover the questions we get most often."
          align="left"
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {HELP_ARTICLES.map((article) => (
            <Link
              key={article.title}
              href={article.href}
              className="group flex items-start gap-3 rounded-xl border border-border/60 bg-card p-4 card-hover"
            >
              <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <LifeBuoy className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold group-hover:text-primary transition-colors">{article.title}</h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">{article.category}</p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
            </Link>
          ))}
        </div>
      </Section>

      {/* Still need help */}
      <Section>
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-2xl font-bold tracking-tight mb-3">Still need help? Contact support</h2>
          <p className="text-muted-foreground mb-6 leading-relaxed">
            Can&apos;t find what you&apos;re looking for? Email us at{" "}
            <a href="mailto:support@z-crm.app" className="text-primary font-medium hover:underline">
              support@z-crm.app
            </a>{" "}
            and we&apos;ll respond within 24 hours. Yearly and Lifetime plans include priority chat support.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-xl font-semibold shadow-soft hover:bg-primary/90 transition-colors"
            >
              Contact support <ArrowRight className="h-4 w-4" />
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
        title="Ready to try Z-CRM?"
        subtitle="Start your 7-day free trial. No credit card required."
        secondaryCTA="View pricing"
        secondaryHref="/pricing"
      />
    </>
  );
}
