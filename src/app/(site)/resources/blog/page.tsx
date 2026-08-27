import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Calendar, Clock, User } from "lucide-react";
import { PageHero } from "@/components/site/PageHero";
import { Section, SectionHeader } from "@/components/site/Section";
import { CTASection } from "@/components/site/CTASection";
import { BLOG_POSTS } from "@/lib/site-content";

export const metadata: Metadata = {
  title: "Blog — Insights from the Z-CRM team",
  description:
    "Engineering deep-dives, integration tutorials, and Bangladesh business insights from the team that builds Z-CRM.",
  alternates: { canonical: "https://z-crm.app/resources/blog" },
};

const CATEGORY_TONES: Record<string, string> = {
  Engineering: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  Tutorial: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  Accounting: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  Integrations: "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20",
  Automation: "bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20",
  Inventory: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20",
};

function formatDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

export default function BlogPage() {
  const [featured, ...rest] = BLOG_POSTS;
  const featuredTone = CATEGORY_TONES[featured.category] || CATEGORY_TONES.Tutorial;

  return (
    <>
      <PageHero
        eyebrow="Blog"
        title="Insights from the Z-CRM team"
        description="Engineering deep-dives, integration tutorials, and Bangladesh business insights — from the team that builds Z-CRM."
        breadcrumbs={[{ label: "Resources" }, { label: "Blog" }]}
      />

      {/* Featured post */}
      <Section className="pt-0">
        <SectionHeader eyebrow="Featured" title="Latest from the team" align="left" />
        <Link
          href="/resources/blog#featured"
          className="group block rounded-2xl border border-border/60 bg-card overflow-hidden card-hover"
        >
          <div className="grid grid-cols-1 md:grid-cols-5">
            {/* Visual panel */}
            <div className="md:col-span-2 relative min-h-[200px] bg-gradient-to-br from-primary/15 via-primary/5 to-cyan-500/10 flex items-center justify-center p-8">
              <div className="absolute -top-20 -left-20 h-64 w-64 rounded-full bg-primary/15 blur-3xl" />
              <div className="absolute -bottom-20 -right-20 h-64 w-64 rounded-full bg-cyan-500/15 blur-3xl" />
              <div className="relative text-center">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-primary mb-1">
                  Featured Post
                </div>
                <div className="text-3xl font-bold gradient-text">
                  {featured.category}
                </div>
              </div>
            </div>
            {/* Content panel */}
            <div className="md:col-span-3 p-6 md:p-8 flex flex-col">
              <div className="flex items-center gap-2 mb-3">
                <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${featuredTone}`}>
                  {featured.category}
                </span>
                <span className="text-xs text-muted-foreground">{formatDate(featured.date)}</span>
                <span className="text-xs text-muted-foreground">·</span>
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" /> {featured.readTime}
                </span>
              </div>
              <h2 className="text-xl md:text-2xl font-bold tracking-tight mb-3 group-hover:text-primary transition-colors">
                {featured.title}
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed mb-4 flex-1">
                {featured.excerpt}
              </p>
              <div className="flex items-center gap-2 text-sm font-medium text-primary">
                Read article <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </div>
          </div>
        </Link>
      </Section>

      {/* Grid of remaining posts */}
      <Section className="bg-muted/5 border-y border-border/20">
        <SectionHeader
          eyebrow="Recent posts"
          title="More from the blog"
          description="Deep dives on engineering, integrations, accounting, and automation — all written by the Z-CRM team."
          align="left"
        />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {rest.map((post) => {
            const tone = CATEGORY_TONES[post.category] || CATEGORY_TONES.Tutorial;
            return (
              <Link
                key={post.title}
                href={`/resources/blog#${post.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`}
                className="group flex flex-col rounded-2xl border border-border/60 bg-card p-5 card-hover"
              >
                <div className="flex items-center gap-2 mb-3">
                  <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-medium ${tone}`}>
                    {post.category}
                  </span>
                  <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground ml-auto">
                    <Clock className="h-3 w-3" /> {post.readTime}
                  </span>
                </div>
                <h3 className="text-base font-semibold leading-snug mb-2 group-hover:text-primary transition-colors">
                  {post.title}
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed mb-4 flex-1">
                  {post.excerpt}
                </p>
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground pt-3 border-t border-border/40">
                  <Calendar className="h-3 w-3" />
                  {formatDate(post.date)}
                </div>
              </Link>
            );
          })}
        </div>
      </Section>

      {/* Newsletter / CTA */}
      <Section>
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-2xl bg-primary/10 text-primary mb-4">
            <User className="h-6 w-6" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight mb-3">Get the next post in your inbox</h2>
          <p className="text-muted-foreground mb-6 leading-relaxed">
            We publish a new post every week — engineering, integrations, and Bangladesh business insights. No spam,
            unsubscribe anytime.
          </p>
          <form className="max-w-md mx-auto flex gap-2" action="/api/subscribe" method="POST">
            <input
              type="email"
              name="email"
              required
              placeholder="you@example.com"
              aria-label="Email address"
              className="flex-1 h-11 px-4 rounded-xl border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40 transition-colors"
            />
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 bg-primary text-primary-foreground px-4 py-2.5 rounded-xl text-sm font-semibold shadow-soft hover:bg-primary/90 transition-colors"
            >
              Subscribe <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </form>
        </div>
      </Section>

      <CTASection
        title="Run your business with Z-CRM"
        subtitle="Start your 7-day free trial. No credit card required."
        secondaryCTA="View pricing"
        secondaryHref="/pricing"
      />
    </>
  );
}
