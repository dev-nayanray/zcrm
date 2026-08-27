"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { IconByName } from "./FeatureCard";
import { INTEGRATIONS } from "@/lib/site-content";

export function IntegrationCard({ integration, index = 0 }: { integration: typeof INTEGRATIONS[0]; index?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.5, delay: index * 0.06, ease: [0.16, 1, 0.3, 1] }}
    >
      <Link
        href={integration.href}
        className="block rounded-2xl border border-border/60 bg-card p-5 card-hover h-full"
      >
        <div className="flex items-start justify-between mb-3">
          <div
            className="h-10 w-10 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: `${integration.color}15`, color: integration.color }}
          >
            <IconByName name={integration.icon} className="h-5 w-5" />
          </div>
          <span className="text-[10px] font-medium text-muted-foreground bg-muted rounded-full px-2 py-0.5">
            {integration.category}
          </span>
        </div>
        <h3 className="font-semibold text-sm mb-1">{integration.name}</h3>
        <p className="text-xs text-muted-foreground leading-relaxed mb-3">{integration.description}</p>
        <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
          Learn more <ArrowRight className="h-3 w-3" />
        </span>
      </Link>
    </motion.div>
  );
}

export function IntegrationGrid() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {INTEGRATIONS.map((i, idx) => (
        <IntegrationCard key={i.key} integration={i} index={idx} />
      ))}
    </div>
  );
}
