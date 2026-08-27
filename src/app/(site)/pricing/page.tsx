import type { Metadata } from "next";
import Link from "next/link";
import { Check, ArrowRight } from "lucide-react";
import { PageHero } from "@/components/site/PageHero";
import { Section, SectionHeader } from "@/components/site/Section";
import { PricingCards } from "@/components/site/PricingCards";
import { CTASection } from "@/components/site/CTASection";
import { FAQAccordion } from "@/components/site/FAQAccordion";
import { FAQS } from "@/lib/site-content";

export const metadata: Metadata = {
  title: "Pricing — Simple, transparent pricing",
  description: "Z-CRM starts at ৳500/week. No annual contract required. Every plan includes a 7-day free trial — no credit card needed.",
  alternates: { canonical: "https://z-crm.app/pricing" },
};

export default function PricingPage() {
  return (
    <>
      <PageHero
        eyebrow="Pricing"
        title="Simple, transparent pricing"
        description="Start at ৳500/week. No annual contract required. Every plan includes a 7-day free trial — no credit card needed. Cancel anytime."
        breadcrumbs={[{ label: "Pricing" }]}
      >
        <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 text-xs font-medium text-emerald-600">
          <Check className="h-3 w-3" /> 7-day free trial · No credit card required
        </div>
      </PageHero>

      <Section className="pt-0">
        <PricingCards />
      </Section>

      {/* Plan comparison table */}
      <Section className="bg-muted/5 border-y border-border/20">
        <SectionHeader
          eyebrow="Compare plans"
          title="Find the right plan for your business"
          description="All plans include all 18 modules, all integrations, and a 7-day free trial."
        />
        <div className="max-w-4xl mx-auto rounded-2xl border border-border/60 bg-card overflow-hidden overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/40 bg-muted/30">
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Feature</th>
                <th className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-wider">Weekly</th>
                <th className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-wider text-primary">Monthly</th>
                <th className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-wider">Yearly</th>
                <th className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-wider">Lifetime</th>
              </tr>
            </thead>
            <tbody>
              {[
                { label: "Price", weekly: "৳500/wk", monthly: "৳1,800/mo", yearly: "৳18,000/yr", lifetime: "৳50,000" },
                { label: "Users", weekly: "2", monthly: "10", yearly: "50", lifetime: "Unlimited" },
                { label: "Warehouses", weekly: "1", monthly: "3", yearly: "Unlimited", lifetime: "Unlimited" },
                { label: "Orders/month", weekly: "1,000", monthly: "10,000", yearly: "100,000", lifetime: "Unlimited" },
                { label: "All 18 modules", weekly: true, monthly: true, yearly: true, lifetime: true },
                { label: "WooCommerce", weekly: true, monthly: true, yearly: true, lifetime: true },
                { label: "WhatsApp + Meta", weekly: true, monthly: true, yearly: true, lifetime: true },
                { label: "Telegram Bot", weekly: false, monthly: true, yearly: true, lifetime: true },
                { label: "Automation engine", weekly: false, monthly: true, yearly: true, lifetime: true },
                { label: "Priority support", weekly: false, monthly: true, yearly: true, lifetime: true },
                { label: "Onboarding", weekly: false, monthly: false, yearly: true, lifetime: true },
                { label: "Lifetime updates", weekly: false, monthly: false, yearly: false, lifetime: true },
              ].map((row) => (
                <tr key={row.label} className="border-b border-border/20 last:border-b-0">
                  <td className="px-4 py-3 font-medium">{row.label}</td>
                  <td className="text-center px-4 py-3">{renderCell(row.weekly)}</td>
                  <td className="text-center px-4 py-3 bg-primary/5">{renderCell(row.monthly)}</td>
                  <td className="text-center px-4 py-3">{renderCell(row.yearly)}</td>
                  <td className="text-center px-4 py-3">{renderCell(row.lifetime)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* Pricing FAQ */}
      <Section>
        <SectionHeader
          eyebrow="Pricing FAQ"
          title="Common questions about pricing"
        />
        <div className="max-w-3xl mx-auto">
          <FAQAccordion items={FAQS.filter((f) => f.q.toLowerCase().includes("cost") || f.q.toLowerCase().includes("pay") || f.q.toLowerCase().includes("trial") || f.q.toLowerCase().includes("free") || f.q.toLowerCase().includes("support"))} />
        </div>
      </Section>

      <CTASection
        title="Start your free trial today"
        subtitle="No credit card required. Cancel anytime."
      />
    </>
  );
}

function renderCell(value: string | boolean) {
  if (value === true) return <Check className="h-4 w-4 text-primary mx-auto" />;
  if (value === false) return <span className="text-muted-foreground text-xs">—</span>;
  return <span className="text-xs">{value}</span>;
}
