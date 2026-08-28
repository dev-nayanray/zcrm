"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollText } from "lucide-react";
import { PageHeader, DataTable } from "../ui";
import { toast } from "sonner";
import { formatDate } from "@/lib/date-range";

type Log = { id: string; userId?: string | null; action: string; entity: string; entityId?: string | null; changes?: any; ipAddress?: string | null; source?: string | null; createdAt: string; user?: { id: string; name: string; email: string } | null };

export function AuditView() {
  const [rows, setRows] = useState<Log[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [entity, setEntity] = useState("ALL");
  const [source, setSource] = useState("ALL");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page)); params.set("limit", "25");
      if (search) params.set("search", search);
      if (entity !== "ALL") params.set("entity", entity);
      if (source !== "ALL") params.set("source", source);
      const r = await api.get<{ items: Log[]; total: number }>(`/api/v1/audit?${params}`);
      setRows(r.items); setTotal(r.total);
    } catch (e) { toast.error((e as Error).message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [page, entity, source]);
  useEffect(() => { setPage(1); load(); }, [search]);

  return (
    <div>
      <PageHeader title="Audit Logs" description="Immutable record of every business-critical action." />
      <DataTable<Log>
        rows={rows} loading={loading} page={page} totalPages={Math.ceil(total / 25) || 1} total={total} limit={25}
        onPage={setPage} search={search} onSearch={setSearch}
        toolbar={
          <>
            <Select value={entity} onValueChange={(v) => { setEntity(v); setPage(1); }}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All entities</SelectItem>
                <SelectItem value="Order">Orders</SelectItem>
                <SelectItem value="Payment">Payments</SelectItem>
                <SelectItem value="Product">Products</SelectItem>
                <SelectItem value="Purchase">Purchases</SelectItem>
                <SelectItem value="Expense">Expenses</SelectItem>
                <SelectItem value="Return">Returns</SelectItem>
                <SelectItem value="User">Users</SelectItem>
                <SelectItem value="Setting">Settings</SelectItem>
                <SelectItem value="Integration">Integrations</SelectItem>
              </SelectContent>
            </Select>
            <Select value={source} onValueChange={(v) => { setSource(v); setPage(1); }}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All sources</SelectItem>
                <SelectItem value="WEB">Web</SelectItem>
                <SelectItem value="TELEGRAM">Telegram</SelectItem>
                <SelectItem value="WOOCOMMERCE">WooCommerce</SelectItem>
                <SelectItem value="API">API</SelectItem>
                <SelectItem value="SYSTEM">System</SelectItem>
              </SelectContent>
            </Select>
          </>
        }
        columns={[
          { key: "time", header: "Time", render: (r) => <span className="text-xs whitespace-nowrap">{formatDate(r.createdAt)}</span> },
          { key: "action", header: "Action", render: (r) => <span className="font-medium"><ScrollText className="h-3.5 w-3.5 inline mr-1 text-muted-foreground" />{r.action}</span> },
          { key: "user", header: "User", render: (r) => r.user ? r.user.name : "—" },
          { key: "source", header: "Source", render: (r) => r.source ? <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-muted text-muted-foreground ring-1 ring-inset ring-border">{r.source}</span> : "—" },
          { key: "entity", header: "Entity", render: (r) => <span className="text-xs">{r.entity}{r.entityId ? ` · ${r.entityId.slice(-8)}` : ""}</span> },
          { key: "changes", header: "Changes", render: (r) => r.changes ? <code className="text-[10px] block max-w-xs truncate text-muted-foreground">{typeof r.changes === "string" ? r.changes : JSON.stringify(r.changes)}</code> : "—" },
        ]}
      />
    </div>
  );
}
