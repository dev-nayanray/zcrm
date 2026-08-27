"use client";

import Link from "next/link";
import { Sparkles, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

// Final CTA banner — reusable across all pages.
export function CTASection({
  title = "Ready to unify your business?",
  subtitle = "Start your 7-day free trial. No credit card required. Cancel anytime.",
  primaryCTA = "Start Free Trial",
  primaryHref = "/register",
  secondaryCTA = "View Pricing",
  secondaryHref = "/pricing",
}: {
  title?: string;
  subtitle?: string;
  primaryCTA?: string;
  primaryHref?: string;
  secondaryCTA?: string;
  secondaryHref?: string;
}) {
  return (
    <section className="py-20 px-4 md:px-6">
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="relative overflow-hidden rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/10 via-primary/5 to-cyan-500/5 p-8 md:p-12 text-center"
        >
          <div className="absolute -top-32 -right-32 h-72 w-72 rounded-full bg-primary/20 blur-3xl -z-10" />
          <div className="absolute -bottom-32 -left-32 h-72 w-72 rounded-full bg-cyan-500/15 blur-3xl -z-10" />
          <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 border border-primary/20 px-3 py-1 text-xs font-medium text-primary mb-4">
            <Sparkles className="h-3 w-3" /> 7-day free trial
          </div>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">{title}</h2>
          <p className="text-muted-foreground max-w-xl mx-auto mb-6">{subtitle}</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href={primaryHref}
              className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-xl font-semibold shadow-soft hover:bg-primary/90 transition-colors"
            >
              {primaryCTA}
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href={secondaryHref}
              className="inline-flex items-center gap-2 border border-border bg-card px-6 py-3 rounded-xl font-medium hover:bg-accent transition-colors"
            >
              {secondaryCTA}
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
