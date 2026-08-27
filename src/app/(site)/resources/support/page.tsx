import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Mail, LifeBuoy, BookOpen, Users, Check } from "lucide-react";
import { PageHero } from "@/components/site/PageHero";
import { Section, SectionHeader } from "@/components/site/Section";
import { CTASection } from "@/components/site/CTASection";
import { SITE } from "@/lib/site-content";

export const metadata: Metadata = {
  title: "Support — We're here to help",
  description:
    "Email support, help center, documentation, and community. Plus support tiers for every plan — from email to dedicated.",
  alternates: { canonical: "https://z-crm.app/resources/support" },
};

const SUPPORT_CHANNELS = [
  {
    icon: "Mail",
    title: "Email Support",
    description: "Email us and we'll respond within 24 hours on weekdays.",
    primary: SITE.supportEmail,
    href: `mailto:${SITE.supportEmail}`,
    cta: "Email us",
    tone: "emerald",
  },
  {
    icon: "LifeBuoy",
    title: "Help Center",
    description: "Browse our knowledge base of guides, troubleshooting, and reference docs.",
    primary: "95+ articles",
    href: "/resources/help",
    cta: "Browse articles",
    tone: "blue",
  },
  {
    icon: "BookOpen",
    title: "Documentation",
    description: "Reference docs for every module — orders, inventory, payments, integrations, security, reports.",
    primary: "8 categories",
    href: "/resources/docs",
    cta: "Read the docs",
    tone: "violet",
  },
  {
    icon: "Users",
    title: "Community",
    description: "Connect with other Z-CRM users, share workflows, and get peer support.",
    primary: "2,400+ businesses",
    href: "/contact",
    cta: "Join community",
    tone: "amber",
  },
];

const SUPPORT_TIERS = [
  {
    plan: "Weekly",
    price: "৳500/wk",
    highlight: false,
    features: [
      { label: "Email support", included: true },
      { label: "24-hour response time (weekdays)", included: true },
      { label: "Access to help center and docs", included: true },
      { label: "Priority email + chat support", included: false },
      { label: "Onboarding session", included: false },
      { label: "Dedicated support contact", included: false },
    ],
  },
  {
    plan: "Monthly",
    price: "৳1,800/mo",
    highlight: true,
    features: [
      { label: "Email support", included: true },
      { label: "24-hour response time (weekdays)", included: true },
      { label: "Access to help center and docs", included: true },
      { label: "Priority email + chat support", included: true },
      { label: "Onboarding session", included: false },
      { label: "Dedicated support contact", included: false },
    ],
  },
  {
    plan: "Yearly",
    price: "৳18,000/yr",
    highlight: false,
    features: [
      { label: "Email support", included: true },
      { label: "24-hour response time (weekdays)", included: true },
      { label: "Access to help center and docs", included: true },
      { label: "Priority email + chat support", included: true },
      { label: "Onboarding session", included: true },
      { label: "Dedicated support contact", included: false },
    ],
  },
  {
    plan: "Lifetime",
    price: "৳50,000",
    highlight: false,
    features: [
      { label: "Email support", included: true },
      { label: "24-hour response time (weekdays)", included: true },
      { label: "Access to help center and docs", included: true },
      { label: "Priority email + chat support", included: true },
      { label: "Onboarding session", included: true },
      { label: "Dedicated support contact", included: true },
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

export default function SupportPage() {
  return (
    <>
      <PageHero
        eyebrow="Support"
        title="We're here to help"
        description="Email us, browse the help center, read the docs, or connect with the community. We respond within 24 hours on weekdays."
        breadcrumbs={[{ label: "Resources" }, { label: "Support" }]}
      />

      {/* Support channels */}
      <Section className="pt-0">
        <SectionHeader
          eyebrow="Get in touch"
          title="Choose a channel"
          description="Pick whatever works best for you. Email is the fastest for most issues."
          align="left"
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
          {SUPPORT_CHANNELS.map((channel) => {
            const tone = TONE_CLASSES[channel.tone] || TONE_CLASSES.emerald;
            const Icon = ({ Mail, LifeBuoy, BookOpen, Users } as Record<string, React.ComponentType<{ className?: string }>>)[channel.icon];
            return (
              <Link
                key={channel.title}
                href={channel.href}
                className="group rounded-2xl border border-border/60 bg-card p-5 card-hover flex flex-col"
              >
                <div className={`h-10 w-10 rounded-xl flex items-center justify-center mb-3 ${tone.bg} ${tone.text}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="font-semibold text-sm mb-1.5">{channel.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed mb-3">{channel.description}</p>
                <div className="mt-auto">
                  <p className="text-xs font-medium text-foreground mb-2">{channel.primary}</p>
                  <div className="inline-flex items-center gap-1 text-xs font-medium text-primary group-hover:gap-1.5 transition-all">
                    {channel.cta} <ArrowRight className="h-3 w-3" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </Section>

      {/* Support tiers table */}
      <Section className="bg-muted/5 border-y border-border/20">
        <SectionHeader
          eyebrow="Support tiers"
          title="What's included in your plan"
          description="Every plan includes email support and full access to the help center. Higher tiers add priority response and dedicated contacts."
          align="left"
        />
        <div className="max-w-5xl mx-auto rounded-2xl border border-border/60 bg-card overflow-hidden overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/40 bg-muted/30">
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Feature</th>
                {SUPPORT_TIERS.map((tier) => (
                  <th
                    key={tier.plan}
                    className={`text-center px-4 py-3 text-xs font-semibold uppercase tracking-wider ${tier.highlight ? "text-primary" : ""}`}
                  >
                    <div>{tier.plan}</div>
                    <div className="font-bold normal-case tracking-normal mt-1 text-sm">{tier.price}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {SUPPORT_TIERS[0].features.map((feature, rowIdx) => (
                <tr key={feature.label} className="border-b border-border/20 last:border-b-0">
                  <td className="px-4 py-3 font-medium text-xs md:text-sm">{feature.label}</td>
                  {SUPPORT_TIERS.map((tier) => {
                    const cell = tier.features[rowIdx];
                    return (
                      <td
                        key={tier.plan}
                        className={`text-center px-4 py-3 ${tier.highlight ? "bg-primary/5" : ""}`}
                      >
                        {cell.included ? (
                          <Check className="h-4 w-4 text-primary mx-auto" />
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* Contact support CTA */}
      <Section>
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-2xl bg-primary/10 text-primary mb-4">
            <Mail className="h-6 w-6" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight mb-3">Contact support</h2>
          <p className="text-muted-foreground mb-6 leading-relaxed">
            Have a question or running into an issue? Email us at{" "}
            <a href={`mailto:${SITE.supportEmail}`} className="text-primary font-medium hover:underline">
              {SITE.supportEmail}
            </a>{" "}
            and we&apos;ll respond within 24 hours on weekdays. For urgent production issues, please mention
            &quot;URGENT&quot; in the subject line.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-xl font-semibold shadow-soft hover:bg-primary/90 transition-colors"
            >
              Open contact form <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href={`mailto:${SITE.supportEmail}`}
              className="inline-flex items-center gap-2 border border-border bg-card px-5 py-2.5 rounded-xl font-medium hover:bg-accent transition-colors"
            >
              {SITE.supportEmail}
            </a>
          </div>
        </div>
      </Section>

      <CTASection
        title="Run your business with confidence"
        subtitle="Start your 7-day free trial. No credit card required."
        secondaryCTA="View pricing"
        secondaryHref="/pricing"
      />
    </>
  );
}
