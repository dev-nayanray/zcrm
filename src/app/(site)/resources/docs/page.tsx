import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BookOpen, LifeBuoy } from "lucide-react";
import { PageHero } from "@/components/site/PageHero";
import { Section, SectionHeader } from "@/components/site/Section";
import { CTASection } from "@/components/site/CTASection";
import { IconByName } from "@/components/site/FeatureCard";

export const metadata: Metadata = {
  title: "Documentation — Everything you need to use Z-CRM",
  description:
    "Guides and reference docs for every Z-CRM module: orders, inventory, customers, payments, integrations, security, and reports.",
  alternates: { canonical: "https://z-crm.app/resources/docs" },
};

const DOC_CATEGORIES = [
  {
    icon: "Rocket",
    title: "Getting Started",
    description: "Sign up, invite your team, and complete the first-run checklist in under 15 minutes.",
    articles: ["Quickstart", "First-run checklist", "Inviting team members", "Choosing a pricing plan"],
    tone: "emerald",
  },
  {
    icon: "ShoppingCart",
    title: "Orders",
    description: "Create, search, and fulfill orders. Bulk entry, line-item discounts, and the order status machine.",
    articles: ["Creating an order", "Order status workflow", "Bulk order entry", "Returns and refunds"],
    tone: "blue",
  },
  {
    icon: "Boxes",
    title: "Inventory",
    description: "Ledger-based stock, multi-warehouse, transfers, reconciliation, and damaged buckets.",
    articles: ["Stock movements ledger", "Multi-warehouse transfers", "Stock count reconciliation", "Damaged stock"],
    tone: "amber",
  },
  {
    icon: "Users",
    title: "Customers",
    description: "Customer 360°, credit limits, advance payments, and lifetime purchase history.",
    articles: ["Customer profiles", "Credit limits", "Advance payments", "Customer dues"],
    tone: "teal",
  },
  {
    icon: "Wallet",
    title: "Payments",
    description: "Cash, bKash, Nagad, bank, card, and wallet. Cash register with daily closing.",
    articles: ["Recording payments", "Cash register", "Daily closing", "Payment reconciliation"],
    tone: "emerald",
  },
  {
    icon: "Plug",
    title: "Integrations",
    description: "WooCommerce, WhatsApp, Facebook, Telegram, Pathao, Steadfast, RedX, bKash, Nagad.",
    articles: ["WooCommerce sync", "WhatsApp Business Cloud API", "Meta Lead Ads", "Courier integration"],
    tone: "violet",
  },
  {
    icon: "ShieldCheck",
    title: "Security",
    description: "HMAC sessions, PBKDF2-600k, RBAC with 60+ permissions, immutable audit logs.",
    articles: ["Roles and permissions", "Audit logs", "Webhook signatures", "Password policy"],
    tone: "rose",
  },
  {
    icon: "BarChart3",
    title: "Reports",
    description: "11 report types with CSV export. P&L, sales, payments, inventory, customers, and more.",
    articles: ["P&L report", "Sales report", "Inventory report", "CSV export"],
    tone: "cyan",
  },
];

const POPULAR_DOCS = [
  { title: "Quickstart guide", description: "Get from sign-up to first order in 15 minutes.", href: "/resources/docs#getting-started", readTime: "5 min" },
  { title: "Order status workflow", description: "PENDING → CONFIRMED → PROCESSING → SHIPPED → DELIVERED → RETURNED → REFUNDED.", href: "/resources/docs#orders", readTime: "4 min" },
  { title: "Multi-warehouse transfers", description: "Move stock between warehouses with the approval workflow.", href: "/resources/docs#inventory", readTime: "7 min" },
  { title: "Connecting WooCommerce", description: "REST API credentials, webhook secret, sync settings.", href: "/resources/docs#integrations", readTime: "10 min" },
  { title: "Roles and permissions", description: "6 system roles, 60+ permissions, custom roles.", href: "/resources/docs#security", readTime: "8 min" },
  { title: "Cash register daily closing", description: "Opening + inflows − outflows = closing. Reconcile in one click.", href: "/resources/docs#payments", readTime: "6 min" },
  { title: "P&L report explained", description: "Gross profit, COGS, shipping, fulfillment costs, and net profit.", href: "/resources/docs#reports", readTime: "9 min" },
  { title: "Customer credit limits", description: "Per-customer credit limits with outstanding tracking.", href: "/resources/docs#customers", readTime: "5 min" },
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

export default function DocsPage() {
  return (
    <>
      <PageHero
        eyebrow="Documentation"
        title="Everything you need to use Z-CRM"
        description="Guides, references, and walkthroughs for every module. From your first order to multi-warehouse stock reconciliation."
        breadcrumbs={[{ label: "Resources" }, { label: "Documentation" }]}
      />

      {/* Doc categories grid */}
      <Section className="pt-0">
        <SectionHeader
          eyebrow="Browse by topic"
          title="Pick a category to start"
          description="Each category includes quickstart guides, reference docs, and worked examples."
          align="left"
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
          {DOC_CATEGORIES.map((cat) => {
            const tone = TONE_CLASSES[cat.tone] || TONE_CLASSES.emerald;
            const anchor = `#${cat.title.toLowerCase().replace(/\s+/g, "-")}`;
            return (
              <Link
                key={cat.title}
                href={`/resources/docs${anchor}`}
                className="group rounded-2xl border border-border/60 bg-card p-5 card-hover flex flex-col"
              >
                <div className={`h-10 w-10 rounded-xl flex items-center justify-center mb-3 ${tone.bg} ${tone.text}`}>
                  <IconByName name={cat.icon} className="h-5 w-5" />
                </div>
                <h3 className="font-semibold text-sm mb-1.5">{cat.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed mb-3">{cat.description}</p>
                <ul className="space-y-1.5 mt-auto">
                  {cat.articles.map((a) => (
                    <li key={a} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <span className="h-1 w-1 rounded-full bg-primary/40" />
                      {a}
                    </li>
                  ))}
                </ul>
                <div className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                  Browse docs <ArrowRight className="h-3 w-3" />
                </div>
              </Link>
            );
          })}
        </div>
      </Section>

      {/* Popular docs */}
      <Section className="bg-muted/5 border-y border-border/20">
        <SectionHeader
          eyebrow="Popular docs"
          title="Most-read articles"
          description="Start here if you're new to Z-CRM or brushing up on a specific workflow."
          align="left"
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {POPULAR_DOCS.map((doc) => (
            <Link
              key={doc.title}
              href={doc.href}
              className="group flex items-start gap-3 rounded-xl border border-border/60 bg-card p-4 card-hover"
            >
              <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <BookOpen className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold group-hover:text-primary transition-colors">{doc.title}</h3>
                  <span className="text-[10px] text-muted-foreground shrink-0">{doc.readTime}</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">{doc.description}</p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
            </Link>
          ))}
        </div>
      </Section>

      {/* Need help CTA */}
      <Section>
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-2xl bg-primary/10 text-primary mb-4">
            <LifeBuoy className="h-6 w-6" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight mb-3">Need help? Contact support</h2>
          <p className="text-muted-foreground mb-6 leading-relaxed">
            Our support team responds within 24 hours on weekdays. For urgent production issues, Yearly and Lifetime
            plans include priority chat support.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-xl font-semibold shadow-soft hover:bg-primary/90 transition-colors"
            >
              Contact support <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/resources/help"
              className="inline-flex items-center gap-2 border border-border bg-card px-5 py-2.5 rounded-xl font-medium hover:bg-accent transition-colors"
            >
              Visit Help Center
            </Link>
          </div>
        </div>
      </Section>

      <CTASection
        title="Ready to apply what you learned?"
        subtitle="Start your 7-day free trial. No credit card required."
        secondaryCTA="View pricing"
        secondaryHref="/pricing"
      />
    </>
  );
}
