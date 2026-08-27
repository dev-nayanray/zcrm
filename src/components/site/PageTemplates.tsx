"use client";

import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { motion } from "framer-motion";
import { PageHero } from "@/components/site/PageHero";
import { Section, SectionHeader } from "@/components/site/Section";
import { FeatureGrid, IconByName } from "@/components/site/FeatureCard";
import { CTASection } from "@/components/site/CTASection";
import {
  PRODUCT_PAGES, INTEGRATIONS, INTEGRATION_DETAILS,
  USE_CASES, USE_CASE_DETAILS,
} from "@/lib/site-content";

// ─── Product page template ───
export function ProductPage({ slug }: { slug: string }) {
  const product = PRODUCT_PAGES.find((p) => p.slug === slug);
  if (!product) return null;
  const features = product.features.map((f, i) => ({
    icon: ["Boxes", "TrendingUp", "Wallet", "Users", "Bell", "ShieldCheck"][i % 6],
    title: f.title,
    description: f.description,
    tone: ["emerald", "teal", "cyan", "violet", "amber", "blue"][i % 6],
  }));

  return (
    <>
      <PageHero
        eyebrow={`Z-CRM · ${product.name}`}
        title={product.tagline}
        description={product.description}
        breadcrumbs={[{ label: "Product" }, { label: product.name }]}
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <Link href="/register" className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-xl font-semibold shadow-soft hover:bg-primary/90 transition-colors">
            Start Free Trial <ArrowRight className="h-4 w-4" />
          </Link>
          <Link href="/pricing" className="inline-flex items-center gap-2 border border-border bg-card px-5 py-2.5 rounded-xl font-medium hover:bg-accent transition-colors">
            View Pricing
          </Link>
        </div>
      </PageHero>

      <Section className="pt-0">
        <div className="rounded-2xl border border-border/60 bg-card p-6 md:p-8">
          <h3 className="text-lg font-semibold mb-4">Why it matters</h3>
          <div className="grid sm:grid-cols-2 gap-3">
            {product.benefits.map((benefit) => (
              <div key={benefit} className="flex items-start gap-2.5">
                <div className="h-5 w-5 rounded-full bg-primary/15 flex items-center justify-center shrink-0 mt-0.5">
                  <Check className="h-3 w-3 text-primary" />
                </div>
                <span className="text-sm">{benefit}</span>
              </div>
            ))}
          </div>
        </div>
      </Section>

      <Section className="bg-muted/5 border-y border-border/20">
        <SectionHeader
          eyebrow="Features"
          title={`${product.name} features`}
          description="Built to handle the real-world workflow of Bangladesh businesses."
        />
        <FeatureGrid features={features} columns={3} />
      </Section>

      <Section>
        <SectionHeader
          eyebrow="Explore more"
          title="Related modules"
          description="Z-CRM modules share the same database — every module integrates with every other."
        />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {PRODUCT_PAGES.filter((p) => p.slug !== slug).slice(0, 8).map((p) => (
            <Link key={p.slug} href={`/product/${p.slug}`} className="block rounded-xl border border-border/60 bg-card p-4 card-hover">
              <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-2">
                <IconByName name={p.icon} className="h-4 w-4" />
              </div>
              <h3 className="text-sm font-semibold">{p.name}</h3>
              <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{p.tagline}</p>
            </Link>
          ))}
        </div>
      </Section>

      <CTASection />
    </>
  );
}

// ─── Integration page template ───
export function IntegrationPage({ slug }: { slug: string }) {
  const integration = INTEGRATION_DETAILS.find((i) => i.key === slug);
  if (!integration) return null;
  const features = integration.features.map((f, i) => ({
    icon: ["Webhook", "MessageCircle", "ShoppingBag", "Truck", "Wallet", "ShieldCheck"][i % 6],
    title: f.title,
    description: f.description,
    tone: ["emerald", "teal", "cyan", "violet", "amber", "blue"][i % 6],
  }));

  return (
    <>
      <PageHero
        eyebrow={integration.category}
        title={integration.tagline}
        description={integration.description}
        breadcrumbs={[{ label: "Integrations", href: "/integrations" }, { label: integration.name }]}
      >
        <div className="flex items-center gap-4">
          <div
            className="h-14 w-14 rounded-2xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: `${integration.color}15`, color: integration.color }}
          >
            <IconByName name={integration.icon} className="h-7 w-7" />
          </div>
          <div>
            <h2 className="text-xl font-bold">{integration.name}</h2>
            <p className="text-sm text-muted-foreground">{integration.category}</p>
          </div>
        </div>
      </PageHero>

      <Section className="pt-0">
        <SectionHeader
          eyebrow="Features"
          title={`What you get with ${integration.name}`}
          description="Every Z-CRM integration is built with HMAC-signed webhooks, idempotent processing, and full audit trails."
        />
        <FeatureGrid features={features} columns={3} />
      </Section>

      <Section className="bg-muted/5 border-y border-border/20">
        <SectionHeader
          eyebrow="Setup"
          title={`Get started in ${integration.setup.length} steps`}
          description="Most integrations take less than 5 minutes to configure."
        />
        <div className="max-w-2xl mx-auto space-y-3">
          {integration.setup.map((step, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -8 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.35, delay: i * 0.05 }}
              className="flex items-start gap-3 rounded-xl border border-border/60 bg-card p-4"
            >
              <div className="h-7 w-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0">
                {i + 1}
              </div>
              <p className="text-sm pt-0.5">{step}</p>
            </motion.div>
          ))}
        </div>
      </Section>

      <Section>
        <SectionHeader eyebrow="Explore more" title="Other integrations" />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {INTEGRATIONS.filter((i) => i.key !== slug).slice(0, 8).map((i) => (
            <Link key={i.key} href={i.href} className="block rounded-xl border border-border/60 bg-card p-4 card-hover">
              <div
                className="h-8 w-8 rounded-lg flex items-center justify-center mb-2"
                style={{ backgroundColor: `${i.color}15`, color: i.color }}
              >
                <IconByName name={i.icon} className="h-4 w-4" />
              </div>
              <h3 className="text-sm font-semibold">{i.name}</h3>
              <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{i.category}</p>
            </Link>
          ))}
        </div>
      </Section>

      <CTASection
        title={`Ready to connect ${integration.name}?`}
        subtitle="Start your 7-day free trial. Connect your integration in minutes."
      />
    </>
  );
}

// ─── Use case page template ───
export function UseCasePage({ slug }: { slug: string }) {
  const useCase = USE_CASE_DETAILS.find((u) => u.key === slug);
  if (!useCase) return null;

  return (
    <>
      <PageHero
        eyebrow="Use Case"
        title={useCase.hero}
        description={useCase.description}
        breadcrumbs={[{ label: "Use Cases", href: "/use-cases/ecommerce" }, { label: useCase.name }]}
      >
        <div className="flex flex-wrap gap-2">
          {useCase.features.map((f) => (
            <span key={f} className="inline-flex items-center gap-1 rounded-full bg-muted/60 border border-border/40 px-2.5 py-1 text-[11px] text-muted-foreground">
              <Check className="h-2.5 w-2.5 text-primary" /> {f}
            </span>
          ))}
        </div>
      </PageHero>

      <Section className="pt-0">
        <SectionHeader
          eyebrow="Challenges we solve"
          title="Common pain points — solved"
          description={`For ${useCase.name.toLowerCase()} businesses in Bangladesh.`}
        />
        <div className="max-w-3xl mx-auto space-y-3">
          {useCase.challenges.map((c, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.4, delay: i * 0.05 }}
              className="grid sm:grid-cols-2 gap-3 rounded-xl border border-border/60 bg-card p-4"
            >
              <div className="flex items-start gap-2">
                <div className="h-6 w-6 rounded-full bg-rose-500/15 text-rose-600 flex items-center justify-center shrink-0 text-xs font-bold">!</div>
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Pain</p>
                  <p className="text-sm">{c.pain}</p>
                </div>
              </div>
              <div className="flex items-start gap-2 sm:border-l sm:border-border/40 sm:pl-3">
                <div className="h-6 w-6 rounded-full bg-emerald-500/15 text-emerald-600 flex items-center justify-center shrink-0">
                  <Check className="h-3 w-3" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Solution</p>
                  <p className="text-sm">{c.solution}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </Section>

      <Section className="bg-muted/5 border-y border-border/20">
        <SectionHeader
          eyebrow="How it works"
          title="The Z-CRM workflow"
          description="Every step of your business connected, end-to-end."
        />
        <div className="max-w-4xl mx-auto">
          <div className="flex flex-wrap items-center justify-center gap-2">
            {useCase.workflow.map((step, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.35, delay: i * 0.08 }}
                className="flex items-center gap-2"
              >
                <div className="rounded-lg border border-border/60 bg-card px-3 py-2 text-xs font-medium">
                  {step}
                </div>
                {i < useCase.workflow.length - 1 && (
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </Section>

      <Section>
        <SectionHeader eyebrow="Explore more" title="Other use cases" />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {USE_CASES.filter((u) => u.key !== slug).map((u) => (
            <Link key={u.key} href={u.href} className="block rounded-xl border border-border/60 bg-card p-4 card-hover">
              <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-2">
                <IconByName name={u.icon} className="h-4 w-4" />
              </div>
              <h3 className="text-sm font-semibold">{u.name}</h3>
              <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{u.tagline}</p>
            </Link>
          ))}
        </div>
      </Section>

      <CTASection
        title={`Ready to transform your ${useCase.name.toLowerCase()} business?`}
        subtitle="Start your 7-day free trial. No credit card required."
      />
    </>
  );
}
