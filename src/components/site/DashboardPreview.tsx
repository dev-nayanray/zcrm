"use client";

import { motion } from "framer-motion";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { cn } from "@/lib/utils";

const TONE_CLASSES: Record<string, { bg: string; text: string }> = {
  emerald: { bg: "bg-emerald-500/10", text: "text-emerald-600 dark:text-emerald-400" },
  blue: { bg: "bg-blue-500/10", text: "text-blue-600 dark:text-blue-400" },
  cyan: { bg: "bg-cyan-500/10", text: "text-cyan-600 dark:text-cyan-400" },
};

// Mini dashboard preview used in the hero — shows KPIs + recent orders
// in a glassy mock UI. Pure CSS (no real data) so it renders instantly.
export function DashboardPreview() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.8, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="relative rounded-2xl border border-border/40 bg-card/80 backdrop-blur shadow-pop overflow-hidden"
    >
      {/* Window chrome */}
      <div className="flex items-center gap-1.5 px-4 py-3 border-b border-border/30 bg-muted/30">
        <div className="h-2.5 w-2.5 rounded-full bg-rose-400/60" />
        <div className="h-2.5 w-2.5 rounded-full bg-amber-400/60" />
        <div className="h-2.5 w-2.5 rounded-full bg-emerald-400/60" />
        <div className="ml-3 flex items-center gap-2">
          <div className="h-5 w-5 rounded-md bg-gradient-to-br from-primary to-primary/70" />
          <span className="text-xs font-semibold gradient-text">Z-CRM</span>
        </div>
        <div className="ml-auto text-[10px] text-muted-foreground">Dashboard</div>
      </div>

      {/* KPI grid */}
      <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Today's Sales", value: "৳48,250", trend: "+12%", tone: "emerald", up: true },
          { label: "Orders", value: "127", trend: "+8%", tone: "blue", up: true },
          { label: "Payments", value: "৳32,400", trend: "+15%", tone: "cyan", up: true },
          { label: "Profit", value: "৳18,720", trend: "+22%", tone: "emerald", up: true },
        ].map((kpi, i) => {
          const tone = TONE_CLASSES[kpi.tone] || TONE_CLASSES.emerald;
          return (
            <div key={i} className="rounded-xl border border-border/40 bg-background/50 p-3">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{kpi.label}</p>
              <p className="text-base md:text-lg font-bold tabular-nums mt-0.5">{kpi.value}</p>
              <div className={cn("inline-flex items-center gap-0.5 text-[10px] font-medium mt-1", tone.text)}>
                {kpi.up ? <ArrowUpRight className="h-2.5 w-2.5" /> : <ArrowDownRight className="h-2.5 w-2.5" />}
                {kpi.trend}
              </div>
            </div>
          );
        })}
      </div>

      {/* Recent orders list */}
      <div className="px-4 pb-4">
        <div className="rounded-xl border border-border/40 bg-background/50 overflow-hidden">
          <div className="px-3 py-2 border-b border-border/30 flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Recent Orders</span>
            <span className="text-[10px] text-primary">View all →</span>
          </div>
          {[
            { id: "ORD-001052", customer: "Karim Hassan", total: "৳1,890", status: "DELIVERED", tone: "bg-emerald-500" },
            { id: "ORD-001051", customer: "Ayesha Siddique", total: "৳1,550", status: "SHIPPED", tone: "bg-violet-500" },
            { id: "ORD-001050", customer: "Tanvir Rahman", total: "৳4,180", status: "PROCESSING", tone: "bg-cyan-500" },
            { id: "ORD-001049", customer: "Fatima Begum", total: "৳280", status: "CONFIRMED", tone: "bg-blue-500" },
          ].map((order, i) => (
            <div key={i} className="flex items-center justify-between px-3 py-2 border-b border-border/20 last:border-b-0">
              <div className="flex items-center gap-2 min-w-0">
                <div className={cn("h-1.5 w-1.5 rounded-full shrink-0", order.tone)} />
                <span className="text-xs font-medium font-mono">{order.id}</span>
                <span className="text-xs text-muted-foreground truncate">{order.customer}</span>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-xs font-semibold tabular-nums">{order.total}</span>
                <span className="text-[10px] text-muted-foreground">{order.status}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
