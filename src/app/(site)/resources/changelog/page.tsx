import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, GitCommit } from "lucide-react";
import { PageHero } from "@/components/site/PageHero";
import { Section, SectionHeader } from "@/components/site/Section";
import { CTASection } from "@/components/site/CTASection";
import { CHANGELOG } from "@/lib/site-content";

export const metadata: Metadata = {
  title: "Changelog — What's new in Z-CRM",
  description:
    "Release notes for every Z-CRM version — major releases, features, and fixes. See what changed and when.",
  alternates: { canonical: "https://z-crm.app/resources/changelog" },
};

const TYPE_BADGE: Record<string, { label: string; cls: string }> = {
  Major: { label: "Major", cls: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" },
  Feature: { label: "Feature", cls: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20" },
  Fix: { label: "Fix", cls: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20" },
};

function formatDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

export default function ChangelogPage() {
  return (
    <>
      <PageHero
        eyebrow="Changelog"
        title="What's new in Z-CRM"
        description="Every release — major versions, new features, and fixes. We ship continuously and post notes here whenever something changes."
        breadcrumbs={[{ label: "Resources" }, { label: "Changelog" }]}
      />

      {/* Summary stats */}
      <Section className="pt-0">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="rounded-2xl border border-border/60 bg-card p-4 text-center">
            <div className="text-xl font-bold tracking-tight">{CHANGELOG.length}</div>
            <div className="text-[11px] text-muted-foreground">Releases</div>
          </div>
          <div className="rounded-2xl border border-border/60 bg-card p-4 text-center">
            <div className="text-xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
              {CHANGELOG.filter((c) => c.type === "Major").length}
            </div>
            <div className="text-[11px] text-muted-foreground">Major versions</div>
          </div>
          <div className="rounded-2xl border border-border/60 bg-card p-4 text-center">
            <div className="text-xl font-bold tracking-tight text-blue-600 dark:text-blue-400">
              {CHANGELOG.filter((c) => c.type === "Feature").length}
            </div>
            <div className="text-[11px] text-muted-foreground">Feature releases</div>
          </div>
          <div className="rounded-2xl border border-border/60 bg-card p-4 text-center">
            <div className="text-xl font-bold tracking-tight">v{CHANGELOG[0]?.version}</div>
            <div className="text-[11px] text-muted-foreground">Latest version</div>
          </div>
        </div>
      </Section>

      {/* Timeline */}
      <Section className="pt-0">
        <SectionHeader
          eyebrow="Release history"
          title="All releases"
          description="Most recent first. Click any release to see the full details."
          align="left"
        />
        <div className="relative mt-8">
          {/* Vertical timeline rail */}
          <div className="absolute left-3 md:left-4 top-2 bottom-2 w-px bg-gradient-to-b from-primary/40 via-border to-transparent" />

          <ol className="space-y-6">
            {CHANGELOG.map((entry) => {
              const badge = TYPE_BADGE[entry.type] || TYPE_BADGE.Feature;
              return (
                <li key={entry.version} className="relative pl-10 md:pl-14">
                  {/* Dot */}
                  <div className="absolute left-0 top-1.5 flex h-7 w-7 md:h-9 md:w-9 items-center justify-center rounded-full border border-primary/30 bg-card shadow-soft">
                    <GitCommit className="h-3.5 w-3.5 md:h-4 md:w-4 text-primary" />
                  </div>
                  <div className="rounded-2xl border border-border/60 bg-card p-5 md:p-6 card-hover">
                    <div className="flex flex-wrap items-center gap-3 mb-4">
                      <span className="font-mono text-sm font-semibold tracking-tight">v{entry.version}</span>
                      <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${badge.cls}`}>
                        {badge.label}
                      </span>
                      <span className="text-xs text-muted-foreground">{formatDate(entry.date)}</span>
                    </div>
                    <ul className="space-y-2">
                      {entry.changes.map((change, idx) => (
                        <li key={idx} className="flex items-start gap-2.5 text-sm">
                          <span className="h-1.5 w-1.5 rounded-full bg-primary/40 shrink-0 mt-2" />
                          <span className="text-muted-foreground leading-relaxed">{change}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      </Section>

      {/* Subscribe to updates */}
      <Section className="bg-muted/5 border-y border-border/20">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-2xl font-bold tracking-tight mb-3">Stay in the loop</h2>
          <p className="text-muted-foreground mb-6 leading-relaxed">
            We publish release notes here every time we ship. Get notified about major releases and important fixes.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-xl font-semibold shadow-soft hover:bg-primary/90 transition-colors"
            >
              Get release notifications <ArrowRight className="h-4 w-4" />
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
        title="Try the latest Z-CRM today"
        subtitle="Start your 7-day free trial. No credit card required."
        secondaryCTA="View pricing"
        secondaryHref="/pricing"
      />
    </>
  );
}
