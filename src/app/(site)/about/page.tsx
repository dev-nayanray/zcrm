import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck, Target, Heart, Globe, ArrowRight, Users, Award, Leaf } from "lucide-react";
import { PageHero } from "@/components/site/PageHero";
import { Section, SectionHeader } from "@/components/site/Section";
import { CTASection } from "@/components/site/CTASection";
import { TestimonialGrid } from "@/components/site/TestimonialCard";
import { METRICS } from "@/lib/site-content";

export const metadata: Metadata = {
  title: "About — Built for Bangladesh businesses",
  description: "Z-CRM is built by a Dhaka-based team for Bangladesh businesses. We support bKash, Nagad, Pathao, Steadfast, and RedX out of the box.",
  alternates: { canonical: "https://z-crm.app/about" },
};

export default function AboutPage() {
  return (
    <>
      <PageHero
        eyebrow="About Z-CRM"
        title="Built for Bangladesh businesses"
        description="We built Z-CRM because every other CRM expects you to be in San Francisco. We support bKash, Nagad, Pathao, Steadfast, RedX, and Bangla — out of the box."
        breadcrumbs={[{ label: "About" }]}
      />

      {/* Mission statement */}
      <Section className="pt-0">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-2xl bg-primary/10 text-primary mb-4">
            <Target className="h-6 w-6" />
          </div>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-4">Our mission</h2>
          <p className="text-muted-foreground leading-relaxed text-lg">
            Empower every Bangladesh business — from a one-person WhatsApp shop to a 50-person distributor — with the same enterprise-grade tools. Built locally, priced locally, supported locally.
          </p>
        </div>
      </Section>

      {/* Stats */}
      <Section className="bg-muted/5 border-y border-border/20">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {METRICS.map((metric) => (
            <div key={metric.label} className="text-center md:text-left">
              <div className="text-2xl md:text-3xl font-bold gradient-text mb-1">{metric.value}</div>
              <p className="text-xs font-medium">{metric.label}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{metric.sub}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* Values */}
      <Section>
        <SectionHeader
          eyebrow="Our values"
          title="What we believe in"
        />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { icon: "Heart", title: "Customer obsession", description: "Every feature starts with a customer pain point. We ship when it's solved, not when it's perfect." },
            { icon: "ShieldCheck", title: "Security first", description: "HMAC sessions, PBKDF2-600k, immutable audit logs. Security is not a feature — it's the foundation." },
            { icon: "Globe", title: "Built locally", description: "Dhaka-based team. We understand bKash, Nagad, Pathao, and the realities of running a business in Bangladesh." },
            { icon: "Leaf", title: "Sustainable growth", description: "We price for Bangladesh — ৳500/week works for a side hustle and ৳50,000 lifetime works for a 50-person distributor." },
            { icon: "Users", title: "Customer success", description: "Onboarding, documentation, and support in English + Bangla. We win when you win." },
            { icon: "Award", title: "Quality without compromise", description: "TypeScript strict, 48+ tests, immutable audit logs, signed webhooks. Production-grade from day one." },
          ].map((value) => {
            const Icon = ({ Heart, ShieldCheck, Globe, Leaf, Users, Award } as any)[value.icon];
            return (
              <div key={value.title} className="rounded-2xl border border-border/60 bg-card p-5">
                <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-3">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="font-semibold text-base mb-1">{value.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{value.description}</p>
              </div>
            );
          })}
        </div>
      </Section>

      {/* Story */}
      <Section className="bg-muted/5 border-y border-border/20">
        <div className="max-w-3xl mx-auto">
          <SectionHeader
            eyebrow="Our story"
            title="Why we built Z-CRM"
            align="left"
          />
          <div className="space-y-4 text-sm text-muted-foreground leading-relaxed">
            <p>
              In 2024, our founder was running a small e-commerce business from Dhaka. Orders came in from WooCommerce, WhatsApp, Facebook, and Instagram. Inventory was tracked in a spreadsheet. P&L was a guess at month-end. Courier tracking meant 5 different apps.
            </p>
            <p>
              We tried every CRM we could find. They were either too expensive (priced in USD), too generic (no bKash, no Pathao), or too fragmented (one app for orders, another for inventory, another for accounts).
            </p>
            <p>
              So we built Z-CRM. One system, every module, every channel, every payment method, every courier — built for Bangladesh, priced for Bangladesh, supported from Bangladesh.
            </p>
            <p>
              Today, Z-CRM serves 2,400+ businesses across Bangladesh. From a one-person WhatsApp shop in Khulna to a 50-person distributor in Chittagong. We're just getting started.
            </p>
          </div>
        </div>
      </Section>

      {/* Testimonials */}
      <Section>
        <SectionHeader
          eyebrow="Customer stories"
          title="Loved by businesses across Bangladesh"
        />
        <TestimonialGrid />
      </Section>

      <CTASection
        title="Join 2,400+ businesses"
        subtitle="Start your 7-day free trial. No credit card required."
        secondaryCTA="Talk to us"
        secondaryHref="/contact"
      />
    </>
  );
}
