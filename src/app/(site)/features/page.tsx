import type { Metadata } from "next";
import { PageHero } from "@/components/site/PageHero";
import { Section, SectionHeader } from "@/components/site/Section";
import { FeatureGrid } from "@/components/site/FeatureCard";
import { CTASection } from "@/components/site/CTASection";
import { IntegrationGrid } from "@/components/site/IntegrationCard";
import { TestimonialGrid } from "@/components/site/TestimonialCard";
import { BENTO_FEATURES, MODULES, SECURITY_FEATURES, USE_CASES } from "@/lib/site-content";

export const metadata: Metadata = {
  title: "Features — Everything you need to run your business",
  description: "Explore every Z-CRM feature: orders, inventory, customers, payments, P&L, WhatsApp, WooCommerce, Telegram, automation, kanban, reports, audit logs, and more.",
  alternates: { canonical: "https://z-crm.app/features" },
};

export default function FeaturesPage() {
  return (
    <>
      <PageHero
        eyebrow="Features"
        title="Everything you need to run your business"
        description="Z-CRM replaces the spreadsheets, browser tabs, and notebook apps that hold your business together. Every module shares the same data, the same accounting engine, and the same audit trail."
        breadcrumbs={[{ label: "Features" }]}
      />

      <Section className="pt-0">
        <SectionHeader
          eyebrow="Everything you need"
          title="One system, eight core capabilities"
          description="Built around a stock-movement ledger — the single source of truth for every report, notification, and P&L figure."
        />
        <FeatureGrid features={BENTO_FEATURES} columns={4} />
      </Section>

      <Section className="bg-muted/5 border-y border-border/20">
        <SectionHeader
          eyebrow="18 modules, one database"
          title="Every module you need, built in"
          description="Each module shares the same customer, product, and order data. No more exporting CSVs from one app to import into another."
        />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {MODULES.map((m) => (
            <a key={m.name} href={`/product/${m.href.split("/").pop()}`} className="block rounded-xl border border-border/60 bg-card p-4 card-hover">
              <h3 className="text-sm font-semibold mb-1">{m.name}</h3>
              <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">{m.description}</p>
            </a>
          ))}
        </div>
      </Section>

      <Section>
        <SectionHeader
          eyebrow="Integrations"
          title="Connect every channel you sell on"
          description="WooCommerce, WhatsApp, Facebook, Telegram, Pathao, Steadfast, RedX, bKash, Nagad — all integrated with HMAC-signed webhooks."
        />
        <IntegrationGrid />
      </Section>

      <Section className="bg-muted/5 border-y border-border/20">
        <SectionHeader
          eyebrow="Use cases"
          title="Built for every kind of Bangladesh business"
        />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {USE_CASES.map((uc) => (
            <a key={uc.key} href={uc.href} className="block rounded-2xl border border-border/60 bg-card p-5 card-hover">
              <h3 className="font-semibold text-base mb-1">{uc.name}</h3>
              <p className="text-xs text-muted-foreground mb-3">{uc.tagline}</p>
              <p className="text-xs text-muted-foreground/80 leading-relaxed">{uc.description}</p>
            </a>
          ))}
        </div>
      </Section>

      <Section>
        <SectionHeader
          eyebrow="Security"
          title="Enterprise-grade security for every business"
          description="HMAC-signed sessions, PBKDF2-600k password hashing, 60+ granular permissions, immutable audit logs, and signed webhooks on every integration."
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {SECURITY_FEATURES.map((s) => (
            <div key={s.title} className="rounded-xl border border-border/60 bg-card p-4">
              <h3 className="text-sm font-semibold mb-1">{s.title}</h3>
              <p className="text-[11px] text-muted-foreground leading-relaxed">{s.description}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section className="bg-muted/5 border-y border-border/20">
        <SectionHeader
          eyebrow="Testimonials"
          title="Loved by businesses across Bangladesh"
        />
        <TestimonialGrid />
      </Section>

      <CTASection />
    </>
  );
}
