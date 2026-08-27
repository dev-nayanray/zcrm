"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import * as LucideIcons from "lucide-react";

type IconName = keyof typeof LucideIcons;

const TONE_CLASSES: Record<string, { bg: string; text: string }> = {
  emerald: { bg: "bg-emerald-500/10", text: "text-emerald-600 dark:text-emerald-400" },
  teal: { bg: "bg-teal-500/10", text: "text-teal-600 dark:text-teal-400" },
  cyan: { bg: "bg-cyan-500/10", text: "text-cyan-600 dark:text-cyan-400" },
  violet: { bg: "bg-violet-500/10", text: "text-violet-600 dark:text-violet-400" },
  fuchsia: { bg: "bg-fuchsia-500/10", text: "text-fuchsia-600 dark:text-fuchsia-400" },
  amber: { bg: "bg-amber-500/10", text: "text-amber-600 dark:text-amber-400" },
  blue: { bg: "bg-blue-500/10", text: "text-blue-600 dark:text-blue-400" },
  rose: { bg: "bg-rose-500/10", text: "text-rose-600 dark:text-rose-400" },
};

// Render a Lucide icon by name. We render the icon as a JSX element here
// (not as a component variable) so the linter doesn't complain about
// "creating components during render".
export function IconByName({ name, className }: { name: string; className?: string }) {
  const IconComp = (LucideIcons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[name] || LucideIcons.Circle;
  return <IconComp className={className} />;
}

export function FeatureCard({
  icon,
  title,
  description,
  tone = "emerald",
  href,
}: {
  icon: string;
  title: string;
  description: string;
  tone?: string;
  href?: string;
}) {
  const toneClass = TONE_CLASSES[tone] || TONE_CLASSES.emerald;
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        "rounded-2xl border border-border/60 bg-card p-5 card-hover",
        href && "cursor-pointer",
      )}
    >
      <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center mb-3", toneClass.bg, toneClass.text)}>
        <IconByName name={icon} className="h-5 w-5" />
      </div>
      <h3 className="font-semibold text-sm mb-1">{title}</h3>
      <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
    </motion.div>
  );
}

export function FeatureGrid({
  features,
  columns = 4,
}: {
  features: { icon: string; title: string; description: string; tone?: string; href?: string }[];
  columns?: 2 | 3 | 4;
}) {
  const cols = {
    2: "sm:grid-cols-2",
    3: "sm:grid-cols-2 lg:grid-cols-3",
    4: "sm:grid-cols-2 lg:grid-cols-4",
  }[columns];
  return (
    <div className={cn("grid grid-cols-1 gap-4", cols)}>
      {features.map((f) => (
        <FeatureCard key={f.title} {...f} />
      ))}
    </div>
  );
}

void (undefined as unknown as IconName); // keep type referenced
