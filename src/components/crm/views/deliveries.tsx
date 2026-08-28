"use client";
import { useEffect, useState } from "react";
import { api, money, num } from "@/lib/api-client";
import { useCrmStore } from "@/lib/store";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader, DataTable, StatusBadge } from "../ui";
import { KanbanBoard, ViewToggle, type KanbanColumn } from "../kanban";
import { toast } from "sonner";
import { formatDate } from "@/lib/date-range";

type Delivery = { id: string; status: string; trackingNumber?: string | null; deliveryCharge: string; codAmount: string; actualCourierCost?: string | number; courierName?: string | null; recipientName?: string | null; recipientPhone?: string | null; order: { id: string; orderNumber: string; total: string; customer: { id: string; name: string; phone: string } }; courierProvider?: { id: string; name: string } | null; createdAt: string };

export function DeliveriesView() {
  const { navigate } = useCrmStore();
  const [rows, setRows] = useState<Delivery[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(15);
  const [status, setStatus] = useState("ALL");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [dash, setDash] = useState<any>(null);
  const [view, setView] = useState<"list" | "kanban">("list");
  const [allDeliveries, setAllDeliveries] = useState<Delivery[]>([]);

  async function load() {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      p.set("page", String(page)); p.set("limit", String(limit));
      if (search) p.set("search", search);
      if (status !== "ALL") p.set("status", status);
      const res = await api.get<{ items: Delivery[]; total: number }>(`/api/v1/deliveries?${p}`);
      setRows(res.items); setTotal(res.total);
      const d = await api.get("/api/v1/deliveries/dashboard");
      setDash(d);
    } catch (e) { toast.error((e as Error).message); }
    finally { setLoading(false); }
  }
  async function loadAllForKanban() {
    try {
      const res = await api.get<{ items: Delivery[]; total: number }>(`/api/v1/deliveries?limit=200`);
      setAllDeliveries(res.items);
    } catch (e) { toast.error((e as Error).message); }
  }
  useEffect(() => { if (view === "kanban") loadAllForKanban(); else load(); }, [view, page, status]);
  useEffect(() => { setPage(1); if (view === "list") load(); }, [search]);

  const DELIVERY_STATUSES = ["PENDING", "PACKED", "SHIPPED", "IN_TRANSIT", "DELIVERED", "FAILED", "RETURNED"];
  const kanbanColumns: KanbanColumn<Delivery>[] = DELIVERY_STATUSES.map((s) => ({
    id: s, title: s.replace(/_/g, " "), items: allDeliveries.filter((d) => d.status === s),
  }));
  async function handleKanbanMove(itemId: string, _from: string, to: string) {
    try { await api.patch(`/api/v1/deliveries/${itemId}`, { status: to }); toast.success(`Delivery moved to ${to.replace(/_/g, " ")}`); loadAllForKanban(); }
    catch (e) { toast.error((e as Error).message); loadAllForKanban(); }
  }

  return (
    <div>
      <PageHeader title="Deliveries" description="Order delivery + Bangladesh courier abstraction (Pathao, Steadfast, RedX, Other)." action={
        <div className="flex gap-2 items-center">
          <ViewToggle view={view} onChange={setView} />
          <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All statuses</SelectItem>
              {DELIVERY_STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      } />
      {dash && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2 mb-4">
          {[
            ["Total", dash.total], ["Pending", dash.pending], ["Packed", dash.packed], ["Shipped", dash.shipped],
            ["In Transit", dash.inTransit], ["Delivered", dash.delivered], ["Failed", dash.failed], ["Returned", dash.returned],
          ].map(([l, v]) => (
            <div key={l as string} className="rounded-md border p-2"><div className="text-[10px] text-muted-foreground">{l}</div><div className="text-lg font-bold">{v}</div></div>
          ))}
        </div>
      )}
      {view === "list" ? (
        <DataTable<Delivery>
          rows={rows} loading={loading} page={page} totalPages={Math.ceil(total / limit) || 1} total={total} limit={limit}
          onPage={setPage} search={search} onSearch={setSearch}
          onRowClick={(r) => navigate("deliveries/detail", { id: r.id })}
          columns={[
            { key: "order", header: "Order", render: (r) => <div><div className="font-medium">{r.order.orderNumber}</div><div className="text-xs text-muted-foreground">{r.order.customer?.name}</div></div> },
            { key: "courier", header: "Courier", render: (r) => r.courierProvider?.name ?? r.courierName ?? "—" },
            { key: "tracking", header: "Tracking", render: (r) => r.trackingNumber ? <span className="text-xs font-mono">{r.trackingNumber}</span> : "—" },
            { key: "charge", header: "Charge", render: (r) => <span className="tabular-nums">{money(r.deliveryCharge)}</span> },
            { key: "cost", header: "Cost", render: (r) => <span className="tabular-nums text-muted-foreground">{money(String(r.actualCourierCost ?? 0))}</span> },
            { key: "profit", header: "Profit", render: (r) => {
              const profit = num(r.deliveryCharge) - num(String(r.actualCourierCost ?? 0));
              return <span className={`font-medium tabular-nums ${profit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>{money(profit.toFixed(2))}</span>;
            } },
            { key: "cod", header: "COD", render: (r) => <span className="tabular-nums text-muted-foreground">{money(r.codAmount)}</span> },
            { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
            { key: "date", header: "Date", render: (r) => <span className="text-xs text-muted-foreground whitespace-nowrap">{formatDate(r.createdAt ?? new Date())}</span> },
          ]}
        />
      ) : (
        <KanbanBoard<Delivery>
          columns={kanbanColumns}
          loading={loading}
          onMove={handleKanbanMove}
          onItemClick={(d) => navigate("deliveries/detail", { id: d.id })}
          render={(d) => ({
            title: d.order?.orderNumber ?? "—",
            subtitle: d.order?.customer?.name ?? "—",
            amount: money(d.codAmount),
            badge: d.status,
            meta: d.courierProvider?.name ?? d.courierName ?? "—",
          })}
        />
      )}
    </div>
  );
}


