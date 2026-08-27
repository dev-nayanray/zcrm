"use client";

import { motion } from "framer-motion";
import { Star, Quote } from "lucide-react";
import { TESTIMONIALS } from "@/lib/site-content";

export function TestimonialCard({ testimonial, index = 0 }: { testimonial: typeof TESTIMONIALS[0]; index?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.5, delay: index * 0.06, ease: [0.16, 1, 0.3, 1] }}
      className="rounded-2xl border border-border/60 bg-card p-5 card-hover"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-1">
          {Array.from({ length: testimonial.rating }).map((_, i) => (
            <Star key={i} className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
          ))}
        </div>
        <Quote className="h-5 w-5 text-primary/30" />
      </div>
      <p className="text-sm text-foreground/90 leading-relaxed mb-4">"{testimonial.quote}"</p>
      <div className="flex items-center justify-between pt-3 border-t border-border/40">
        <div>
          <p className="text-sm font-semibold">{testimonial.name}</p>
          <p className="text-xs text-muted-foreground">{testimonial.role} · {testimonial.company}</p>
        </div>
        <div className="text-right">
          <p className="text-xs font-semibold text-primary">{testimonial.metric}</p>
          <p className="text-[10px] text-muted-foreground">{testimonial.location}</p>
        </div>
      </div>
    </motion.div>
  );
}

export function TestimonialGrid() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {TESTIMONIALS.map((t, i) => (
        <TestimonialCard key={t.name} testimonial={t} index={i} />
      ))}
    </div>
  );
}
