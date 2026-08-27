"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RefreshCw } from "lucide-react";
import { PageHeader, DataTable, StatusBadge } from "../ui";
import { toast } from "sonner";
import { formatDate } from "@/lib/date-range";

type Event = { id: string; provider: string; eventId: string; eventType?: string | null; status: string; error?: string | null; retryCount: number; processedAt?: string | null; createdAt: string };

export function IntegrationLogsView() {
  const [rows, setRows] = useState<Event[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(25);
  const [provider, setProvider] = useState("ALL");
  const [status, setStatus] = useState("ALL");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      p.set("page", String(page)); p.set("limit", String(limit));
      if (provider !== "ALL") p.set("provider", provider);
      if (status !== "ALL") p.set("status", status);
      const res = await api.get<{ items: Event[]; total: number }>(`/api/v1/integrations/logs?${p}`);
      setRows(res.items); setTotal(res.total);
    } catch (e) { toast.error((e as Error).message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [page, provider, status]);

  async function retry(id: string) {
    try { await api.post(`/api/v1/webhook-events/${id}/retry`); toast.success("Marked for retry"); load(); }
    catch (e) { toast.error((e as Error).message); }
  }

  return (
    <div>
      <PageHeader title="Integration Logs" description="Unified webhook event log across all providers. Retry failed events." action={
        <div className="flex gap-2">
          <Select value={provider} onValueChange={(v) => { setProvider(v); setPage(1); }}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="ALL">All providers</SelectItem><SelectItem value="whatsapp">WhatsApp</SelectItem><SelectItem value="meta">Meta</SelectItem><SelectItem value="woocommerce">WooCommerce</SelectItem></SelectContent>
          </Select>
          <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="ALL">All</SelectItem><SelectItem value="SUCCESS">Success</SelectItem><SelectItem value="FAILED">Failed</SelectItem><SelectItem value="RETRYING">Retrying</SelectItem><SelectItem value="IGNORED">Ignored</SelectItem></SelectContent>
          </Select>
        </div>
      } />
      <DataTable<Event>
        rows={rows} loading={loading} page={page} totalPages={Math.ceil(total / limit) || 1} total={total} limit={limit}
        onPage={setPage}
        columns={[
          { key: "date", header: "Date", render: (r) => <span className="text-xs">{formatDate(r.createdAt)}</span> },
          { key: "provider", header: "Provider", render: (r) => <span className="font-medium capitalize">{r.provider}</span> },
          { key: "eventId", header: "Event ID", render: (r) => <span className="text-xs font-mono text-muted-foreground">{r.eventId}</span> },
          { key: "eventType", header: "Type", render: (r) => r.eventType ?? "—" },
          { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
          { key: "error", header: "Error", render: (r) => r.error ? <span className="text-xs text-red-600 max-w-xs truncate block">{r.error}</span> : "—" },
          { key: "retries", header: "Retries", render: (r) => r.retryCount },
          { key: "processed", header: "Processed", render: (r) => r.processedAt ? <span className="text-xs">{formatDate(r.processedAt)}</span> : "—" },
          { key: "actions", header: "", render: (r) => (r.status === "FAILED" || r.status === "RETRYING") ? <Button size="sm" variant="outline" className="h-7" onClick={(e) => { e.stopPropagation(); retry(r.id); }}><RefreshCw className="h-3.5 w-3.5 mr-1" /> Retry</Button> : null },
        ]}
      />
    </div>
  );
}
