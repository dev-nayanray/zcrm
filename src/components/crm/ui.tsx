"use client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronLeft, ChevronRight, Search, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

type Column<T> = {
  key: string;
  header: string;
  className?: string;
  render: (row: T) => React.ReactNode;
};

export function DataTable<T extends { id: string }>({
  columns, rows, page, totalPages, total, limit, loading, onPage, search, onSearch,
  emptyMessage = "No records found", toolbar, toolbarRight, onRowClick,
}: {
  columns: Column<T>[]; rows: T[]; page: number; totalPages: number; total: number; limit: number;
  loading?: boolean; onPage?: (p: number) => void; search?: string; onSearch?: (q: string) => void;
  emptyMessage?: string; toolbar?: React.ReactNode; toolbarRight?: React.ReactNode; onRowClick?: (row: T) => void;
}) {
  return (
    <div className="space-y-3">
      {(onSearch || toolbar || toolbarRight) && (
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between fade-in-up">
          <div className="flex gap-2 flex-wrap">
            {onSearch && (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search…" className="pl-9 w-56 h-9" value={search ?? ""} onChange={(e) => onSearch(e.target.value)} />
              </div>
            )}
            {toolbar}
          </div>
          {toolbarRight}
        </div>
      )}
      <div className="rounded-xl border border-border/80 overflow-hidden bg-card shadow-soft">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 backdrop-blur-sm sticky top-0 z-10">
              <tr>
                {columns.map((c) => (
                  <th key={c.key} className={cn("text-left font-semibold text-muted-foreground px-4 py-3 whitespace-nowrap text-xs uppercase tracking-wider", c.className)}>{c.header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-t border-border/60">
                    {columns.map((c) => (
                      <td key={c.key} className="px-4 py-3">
                        <div className="h-4 shimmer rounded" style={{ width: `${60 + Math.random() * 30}%` }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : rows.length === 0 ? (
                <tr className="border-t border-border/60">
                  <td colSpan={columns.length} className="px-4 py-14">
                    <div className="flex flex-col items-center justify-center text-center">
                      <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
                        <Inbox className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <p className="text-sm text-muted-foreground">{emptyMessage}</p>
                    </div>
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr
                    key={row.id}
                    onClick={() => onRowClick?.(row)}
                    className={cn(
                      "border-t border-border/60 transition-colors group",
                      onRowClick ? "cursor-pointer hover:bg-accent/50" : "hover:bg-muted/30",
                    )}
                  >
                    {columns.map((c, idx) => (
                      <td key={c.key} className={cn("px-4 py-3 align-middle", c.className)}>
                        {idx === 0 && onRowClick && (
                          <span className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-1 rounded-r-full bg-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                        )}
                        <span className="relative">{c.render(row)}</span>
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between text-xs text-muted-foreground">
        <span>Showing <span className="font-medium text-foreground">{rows.length}</span> of <span className="font-medium text-foreground">{total}</span> records</span>
        {onPage && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)} className="h-8">
              <ChevronLeft className="h-4 w-4" /> Prev
            </Button>
            <span className="text-xs tabular-nums">Page <span className="font-medium text-foreground">{page}</span> of {Math.max(1, totalPages)}</span>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => onPage(page + 1)} className="h-8">
              Next <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// Status tone → maps a status string to a semantic tone
type Tone = "emerald" | "amber" | "red" | "blue" | "cyan" | "orange" | "fuchsia" | "muted" | "violet";
const STATUS_TONE: Record<string, Tone> = {
  PENDING: "amber", CONFIRMED: "blue", PROCESSING: "cyan", READY_TO_SHIP: "violet", SHIPPED: "violet", DELIVERED: "emerald",
  CANCELLED: "red", RETURNED: "orange", REFUNDED: "fuchsia", UNPAID: "red", PARTIAL: "amber",
  PAID: "emerald", RECEIVED: "emerald", ACTIVE: "emerald", INACTIVE: "muted", COMPLETED: "emerald",
  RETURN_REQUESTED: "orange",
  HEALTHY: "emerald", LOW_STOCK: "amber", OUT_OF_STOCK: "red", SUCCESS: "emerald", FAILED: "red",
  CONNECTED: "emerald", DISCONNECTED: "muted", ERROR: "red", SYNCED: "emerald", LOCAL: "muted",
  OPEN: "blue", RESOLVED: "emerald", CLOSED: "muted", NEW: "blue", CONTACTED: "cyan", QUALIFIED: "violet",
  NEGOTIATION: "amber", FOLLOW_UP: "amber", ORDER_CREATED: "blue", WON: "emerald", LOST: "red",
  CONVERTED: "emerald", ARCHIVED: "muted", DRAFT: "muted", PENDING_APPROVAL: "amber", APPROVED: "emerald", REJECTED: "red",
  RETRYING: "amber", IGNORED: "muted", IN_TRANSIT: "violet", PACKED: "cyan", INCOMING: "blue", OUTGOING: "emerald",
  SENT: "emerald", READ: "muted",
};
const TONE_STYLES: Record<Tone, string> = {
  emerald: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 ring-emerald-500/20",
  amber: "bg-amber-500/10 text-amber-700 dark:text-amber-400 ring-amber-500/20",
  red: "bg-red-500/10 text-red-700 dark:text-red-400 ring-red-500/20",
  blue: "bg-blue-500/10 text-blue-700 dark:text-blue-400 ring-blue-500/20",
  cyan: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 ring-cyan-500/20",
  orange: "bg-orange-500/10 text-orange-700 dark:text-orange-400 ring-orange-500/20",
  fuchsia: "bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-400 ring-fuchsia-500/20",
  violet: "bg-violet-500/10 text-violet-700 dark:text-violet-400 ring-violet-500/20",
  muted: "bg-muted text-muted-foreground ring-border",
};
const TONE_DOT: Record<Tone, string> = {
  emerald: "bg-emerald-500", amber: "bg-amber-500", red: "bg-red-500", blue: "bg-blue-500",
  cyan: "bg-cyan-500", orange: "bg-orange-500", fuchsia: "bg-fuchsia-500", violet: "bg-violet-500",
  muted: "bg-muted-foreground",
};

export function StatusBadge({ status, variant }: { status: string; variant?: "default" | "success" | "warning" | "danger" | "info" }) {
  void variant;
  const tone = STATUS_TONE[status] ?? "muted";
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium ring-1 ring-inset", TONE_STYLES[tone])}>
      <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", TONE_DOT[tone])} />
      <span className="capitalize">{status.replace(/_/g, " ").toLowerCase()}</span>
    </span>
  );
}

export function PageHeader({ title, description, action, breadcrumb }: { title: string; description?: string; action?: React.ReactNode; breadcrumb?: string }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-5 fade-in-up">
      <div className="min-w-0">
        {breadcrumb && (
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1">{breadcrumb}</p>
        )}
        <h1 className="text-xl md:text-2xl font-bold tracking-tight truncate">{title}</h1>
        {description && <p className="text-sm text-muted-foreground mt-1 max-w-2xl">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, description, action }: { icon: React.ComponentType<{ className?: string }>; title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-4 fade-in-up">
      <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-accent to-muted flex items-center justify-center mb-4 ring-1 ring-border/50">
        <Icon className="h-7 w-7 text-muted-foreground" />
      </div>
      <h3 className="font-semibold text-base">{title}</h3>
      {description && <p className="text-sm text-muted-foreground mt-1.5 max-w-sm">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function CardSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="rounded-xl border border-border/80 p-5 space-y-3 shadow-soft">
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="h-4 shimmer rounded" style={{ width: `${100 - i * 12}%` }} />
      ))}
    </div>
  );
}

// KPI stat card — used across dashboard / inventory / deliveries
export function StatCard({ label, value, icon: Icon, delta, deltaLabel, tone = "primary", sub }: {
  label: string; value: string | number; icon: React.ComponentType<{ className?: string }>;
  delta?: number; deltaLabel?: string; tone?: "primary" | "emerald" | "amber" | "red" | "blue" | "violet" | "cyan";
  sub?: string;
}) {
  const toneClasses: Record<string, string> = {
    primary: "from-primary/15 to-primary/5 text-primary ring-primary/20",
    emerald: "from-emerald-500/15 to-emerald-500/5 text-emerald-600 dark:text-emerald-400 ring-emerald-500/20",
    amber: "from-amber-500/15 to-amber-500/5 text-amber-600 dark:text-amber-400 ring-amber-500/20",
    red: "from-red-500/15 to-red-500/5 text-red-600 dark:text-red-400 ring-red-500/20",
    blue: "from-blue-500/15 to-blue-500/5 text-blue-600 dark:text-blue-400 ring-blue-500/20",
    violet: "from-violet-500/15 to-violet-500/5 text-violet-600 dark:text-violet-400 ring-violet-500/20",
    cyan: "from-cyan-500/15 to-cyan-500/5 text-cyan-600 dark:text-cyan-400 ring-cyan-500/20",
  };
  return (
    <div className="rounded-xl border border-border/80 bg-card p-4 shadow-soft card-hover fade-in-up">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider truncate">{label}</p>
          <p className="text-xl md:text-2xl font-bold tracking-tight mt-1 tabular-nums">{value}</p>
        </div>
        <div className={cn("h-10 w-10 rounded-xl bg-gradient-to-br flex items-center justify-center ring-1 shrink-0", toneClasses[tone])}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      {sub && <p className="text-xs text-muted-foreground mt-2">{sub}</p>}
      {delta !== undefined && (
        <div className="flex items-center gap-1.5 mt-2 text-xs">
          <span className={cn("inline-flex items-center gap-0.5 font-semibold tabular-nums", delta >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>
            {delta >= 0 ? "↑" : "↓"} {Math.abs(delta).toFixed(1)}%
          </span>
          {deltaLabel && <span className="text-muted-foreground">{deltaLabel}</span>}
        </div>
      )}
    </div>
  );
}
