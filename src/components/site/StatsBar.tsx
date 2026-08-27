"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { METRICS } from "@/lib/site-content";

// Animated counter for the metrics bar.
function Counter({ to, suffix = "" }: { to: string; suffix?: string }) {
  // Extract numeric portion for the count-up animation.
  const numericMatch = to.match(/[\d.]+/);
  const numeric = numericMatch ? parseFloat(numericMatch[0]) : 0;
  const prefix = to.slice(0, numericMatch?.index ?? 0);
  const trailing = to.slice((numericMatch?.index ?? 0) + (numericMatch?.[0].length ?? 0));

  return (
    <span className="tabular-nums">
      {prefix}
      <motion.span
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
      >
        {numeric.toLocaleString("en-US", { maximumFractionDigits: 2 })}
      </motion.span>
      {trailing}
      {suffix}
    </span>
  );
}

export function StatsBar() {
  return (
    <section className="py-12 px-4 md:px-6 border-y border-border/20 bg-muted/5">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {METRICS.map((metric, i) => (
            <motion.div
              key={metric.label}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
              className="text-center md:text-left"
            >
              <div className="text-2xl md:text-3xl font-bold gradient-text mb-1">
                <Counter to={metric.value} />
              </div>
              <p className="text-xs font-medium">{metric.label}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{metric.sub}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
