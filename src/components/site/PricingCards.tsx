"use client";

import Link from "next/link";
import { Check, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { PRICING, SITE } from "@/lib/site-content";

export function PricingCards({ compact = false }: { compact?: boolean }) {
  return (
    <div className={cn("grid gap-4", compact ? "md:grid-cols-2 lg:grid-cols-4" : "md:grid-cols-2 lg:grid-cols-4")}>
      {PRICING.map((plan, i) => (
        <motion.div
          key={plan.key}
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.5, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
          className={cn(
            "relative rounded-2xl border bg-card p-6 flex flex-col",
            plan.highlight ? "border-primary/40 shadow-glow ring-1 ring-primary/20" : "border-border/60",
          )}
        >
          {plan.badge && (
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 rounded-full bg-primary text-primary-foreground px-3 py-1 text-[10px] font-semibold shadow-soft">
              <Sparkles className="h-3 w-3" /> {plan.badge}
            </div>
          )}
          <div className="mb-4">
            <h3 className="text-base font-semibold">{plan.name}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{plan.description}</p>
          </div>
          <div className="mb-4">
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-bold tabular-nums">{SITE.currencySymbol}{plan.price.toLocaleString("en-US")}</span>
              <span className="text-sm text-muted-foreground">{plan.period}</span>
            </div>
            <p className="text-[11px] text-muted-foreground/80 mt-1">{plan.periodLabel}</p>
          </div>
          <ul className="space-y-2 mb-6 flex-1">
            {plan.features.map((f) => (
              <li key={f} className="flex items-start gap-2 text-xs">
                <Check className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                <span className="text-muted-foreground">{f}</span>
              </li>
            ))}
          </ul>
          <Link
            href={`/register?plan=${plan.key}`}
            className={cn(
              "block text-center px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors",
              plan.highlight
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : "border border-border bg-card hover:bg-accent",
            )}
          >
            {plan.cta}
          </Link>
        </motion.div>
      ))}
    </div>
  );
}
