import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PageHero } from "@/components/site/PageHero";
import { Section, SectionHeader } from "@/components/site/Section";
import { FAQAccordion } from "@/components/site/FAQAccordion";
import { CTASection } from "@/components/site/CTASection";
import { FAQS } from "@/lib/site-content";

export const metadata: Metadata = {
  title: "FAQ — Frequently asked questions",
  description: "Everything you need to know about Z-CRM. Pricing, integrations, security, automation, and more.",
  alternates: { canonical: "https://z-crm.app/faq" },
};

export default function FAQPage() {
  // Group FAQs by category for easier scanning.
  const categories: { title: string; questions: { q: string; a: string }[] }[] = [
    { title: "Getting started", questions: FAQS.slice(0, 2) },
    { title: "Integrations", questions: FAQS.filter((f) => f.q.toLowerCase().includes("woocommerce") || f.q.toLowerCase().includes("whatsapp") || f.q.toLowerCase().includes("telegram")) },
    { title: "Security & data", questions: FAQS.filter((f) => f.q.toLowerCase().includes("financial") || f.q.toLowerCase().includes("roles") || f.q.toLowerCase().includes("payment methods") || f.q.toLowerCase().includes("offline")) },
  ];

  return (
    <>
      <PageHero
        eyebrow="FAQ"
        title="Frequently asked questions"
        description="Everything you need to know about Z-CRM. Can't find an answer? Reach out at support@z-crm.app."
        breadcrumbs={[{ label: "FAQ" }]}
      />

      <Section className="pt-0">
        <div className="max-w-3xl mx-auto">
          <FAQAccordion items={FAQS} />
        </div>
      </Section>

      {/* Still have questions? */}
      <Section className="bg-muted/5 border-y border-border/20">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-2xl font-bold tracking-tight mb-3">Still have questions?</h2>
          <p className="text-muted-foreground mb-6">Our team is happy to help. Reach out and we'll respond within 24 hours.</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/contact" className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-xl font-semibold shadow-soft hover:bg-primary/90 transition-colors">
              Contact support <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/resources/docs" className="inline-flex items-center gap-2 border border-border bg-card px-5 py-2.5 rounded-xl font-medium hover:bg-accent transition-colors">
              Read the docs
            </Link>
          </div>
        </div>
      </Section>

      <CTASection
        title="Ready to try Z-CRM?"
        subtitle="Start your 7-day free trial. No credit card required."
      />
    </>
  );
}
