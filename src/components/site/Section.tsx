"use client";

import { cn } from "@/lib/utils";

// Section wrapper for consistent spacing and width.
export function Section({
  children,
  className,
  containerClassName,
  id,
}: {
  children: React.ReactNode;
  className?: string;
  containerClassName?: string;
  id?: string;
}) {
  return (
    <section id={id} className={cn("py-16 px-4 md:px-6", className)}>
      <div className={cn("max-w-7xl mx-auto", containerClassName)}>
        {children}
      </div>
    </section>
  );
}

// Section header with eyebrow, title, and description.
export function SectionHeader({
  eyebrow,
  title,
  description,
  align = "center",
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: "left" | "center";
}) {
  return (
    <div className={cn("mb-10", align === "center" ? "text-center mx-auto max-w-2xl" : "max-w-2xl")}>
      {eyebrow && (
        <div className={cn("inline-flex items-center gap-1.5 rounded-full bg-primary/10 border border-primary/20 px-3 py-1 text-xs font-medium text-primary mb-3")}>
          {eyebrow}
        </div>
      )}
      <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-3">{title}</h2>
      {description && <p className="text-muted-foreground leading-relaxed">{description}</p>}
    </div>
  );
}
