"use client";
import { useEffect, useState } from "react";
import { api, money, num } from "@/lib/api-client";
import { useCrmStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Download, Trash2, Pencil, MoreVertical } from "lucide-react";
import { PageHeader, DataTable, StatusBadge } from "../ui";
import { KanbanBoard, ViewToggle, DeleteConfirm, EditDialog, type KanbanColumn } from "../kanban";
import { toast } from "sonner";
import { formatDate } from "@/lib/date-range";

type Order = {
  id: string; orderNumber: string; status: string; paymentStatus: string;
  total: string; paidAmount: string;
  customer: { id: string; name: string; phone: string };
  channel: { id: string; name: string };
  itemCount: number; createdAt: string; externalId?: string;
};

const ORDER_STATUSES = ["PENDING", "CONFIRMED", "PROCESSING", "READY_TO_SHIP", "SHIPPED", "DELIVERED", "COMPLETED", "CANCELLED"];

export function OrdersView() {
  const { navigate, params } = useCrmStore();
  const [rows, setRows] = useState<Order[]>([]);
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(15);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState(params.status || "ALL");
  const [loading, setLoading] = useState(true);
  const [payStatus, setPayStatus] = useState("ALL");
  const [view, setView] = useState<"list" | "kanban">("list");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editOrder, setEditOrder] = useState<Order | null>(null);
  const [editForm, setEditForm] = useState({ status: "", notes: "" });

  async function load() {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      p.set("page", String(page));
      p.set("limit", String(limit));
      if (search) p.set("search", search);
      if (status !== "ALL") p.set("status", status);
      if (payStatus !== "ALL") p.set("paymentStatus", payStatus);
      const res = await api.get<{ items: Order[]; total: number }>(`/api/v1/orders?${p}`);
      setRows(res.items);
      setTotal(res.total);
    } catch (e) { toast.error((e as Error).message); }
    finally { setLoading(false); }
  }

  async function loadAllForKanban() {
    try {
      const res = await api.get<{ items: Order[]; total: number }>(`/api/v1/orders?limit=200`);
      setAllOrders(res.items);
    } catch (e) { toast.error((e as Error).message); }
  }

  useEffect(() => { if (view === "kanban") loadAllForKanban(); else load(); }, [view, page, status, payStatus]);
  useEffect(() => { setPage(1); if (view === "list") load(); }, [search]);

  async function handleKanbanMove(itemId: string, _from: string, to: string) {
    try {
      await api.patch(`/api/v1/orders/${itemId}`, { status: to, note: `Moved via Kanban` });
      toast.success(`Order moved to ${to}`);
      loadAllForKanban();
    } catch (e) { toast.error((e as Error).message); loadAllForKanban(); }
  }

  async function confirmDelete() {
    if (!deleteId) return;
    try {
      await api.del(`/api/v1/orders/${deleteId}`);
      toast.success("Order deleted");
      setDeleteId(null);
      load();
    } catch (e) { toast.error((e as Error).message); }
  }

  function openEdit(o: Order) {
    setEditOrder(o);
    setEditForm({ status: o.status, notes: "" });
  }

  async function saveEdit() {
    if (!editOrder) return;
    try {
      await api.patch(`/api/v1/orders/${editOrder.id}`, { status: editForm.status, note: editForm.notes || `Updated via edit dialog` });
      toast.success("Order updated");
      setEditOrder(null);
      load();
    } catch (e) { toast.error((e as Error).message); }
  }

  // Kanban columns
  const kanbanColumns: KanbanColumn<Order>[] = ORDER_STATUSES.map((s) => ({
    id: s,
    title: s.replace(/_/g, " "),
    items: allOrders.filter((o) => o.status === s),
  }));

  return (
    <div>
      <PageHeader
        title="Orders"
        description="Website, WooCommerce and offline orders in one place."
        action={
          <div className="flex gap-2 items-center">
            <ViewToggle view={view} onChange={setView} />
            <Button variant="outline" size="sm" onClick={() => window.open("/api/v1/exports/orders?type=orders", "_blank")}>
              <Download className="h-4 w-4 mr-1" /> Export
            </Button>
            <Button size="sm" onClick={() => navigate("orders/new")}>
              <Plus className="h-4 w-4 mr-1" /> New Order
            </Button>
          </div>
        }
      />

      {view === "list" ? (
        <DataTable<Order>
          rows={rows}
          loading={loading}
          page={page}
          totalPages={Math.ceil(total / limit) || 1}
          total={total}
          limit={limit}
          onPage={setPage}
          search={search}
          onSearch={setSearch}
          emptyMessage="No orders found. Create your first order."
          toolbar={
            <>
              <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
                <SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All statuses</SelectItem>
                  {ORDER_STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={payStatus} onValueChange={(v) => { setPayStatus(v); setPage(1); }}>
                <SelectTrigger className="w-36"><SelectValue placeholder="Payment" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All payments</SelectItem>
                  <SelectItem value="UNPAID">Unpaid</SelectItem>
                  <SelectItem value="PARTIAL">Partial</SelectItem>
                  <SelectItem value="PAID">Paid</SelectItem>
                </SelectContent>
              </Select>
            </>
          }
          onRowClick={(row) => navigate("orders/detail", { id: row.id })}
          columns={[
            { key: "orderNumber", header: "Order #", render: (r) => <div className="font-medium">{r.orderNumber}</div> },
            { key: "customer", header: "Customer", render: (r) => <div><div className="font-medium">{r.customer?.name}</div><div className="text-xs text-muted-foreground">{r.customer?.phone}</div></div> },
            { key: "channel", header: "Channel", render: (r) => <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-muted text-muted-foreground ring-1 ring-inset ring-border">{r.channel?.name ?? "—"}</span> },
            { key: "total", header: "Total", render: (r) => <div className="font-medium tabular-nums">{money(r.total)}</div> },
            { key: "paid", header: "Paid", render: (r) => <div className="text-xs text-muted-foreground tabular-nums">{money(r.paidAmount)}</div> },
            { key: "due", header: "Due", render: (r) => {
              const due = num(r.total) - num(r.paidAmount);
              return <div className={`text-xs font-medium tabular-nums ${due > 0 ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}`}>{due > 0 ? money(due.toFixed(2)) : "—"}</div>;
            } },
            { key: "paymentStatus", header: "Payment", render: (r) => <StatusBadge status={r.paymentStatus} /> },
            { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
            { key: "date", header: "Date", render: (r) => <span className="text-xs text-muted-foreground whitespace-nowrap">{formatDate(r.createdAt)}</span> },
            { key: "actions", header: "", render: (r) => (
              <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(r)}><Pencil className="h-3.5 w-3.5" /></Button>
                {r.status === "PENDING" && Number(r.paidAmount) <= 0 && (
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => setDeleteId(r.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                )}
              </div>
            ) },
          ]}
        />
      ) : (
        <KanbanBoard<Order>
          columns={kanbanColumns}
          loading={loading}
          onMove={handleKanbanMove}
          onItemClick={(o) => navigate("orders/detail", { id: o.id })}
          render={(o) => ({
            title: o.orderNumber,
            subtitle: o.customer?.name ?? "Unknown",
            amount: money(o.total),
            badge: o.status,
            meta: formatDate(o.createdAt).slice(0, 16),
          })}
        />
      )}

      {/* Delete confirm */}
      <DeleteConfirm
        open={!!deleteId}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteId(null)}
        title="Delete Order"
        message="Only unpaid pending orders can be deleted. This action cannot be undone."
      />

      {/* Edit dialog */}
      <EditDialog open={!!editOrder} onClose={() => setEditOrder(null)} title={`Edit Order ${editOrder?.orderNumber ?? ""}`}>
        <div className="space-y-4">
          <div>
            <Label>Status</Label>
            <Select value={editForm.status} onValueChange={(v) => setEditForm({ ...editForm, status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ORDER_STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Note (optional)</Label>
            <Textarea value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} placeholder="Add a note for this status change" />
          </div>
          <div className="flex gap-2 pt-2">
            <Button onClick={saveEdit} className="flex-1">Save Changes</Button>
            <Button variant="outline" onClick={() => setEditOrder(null)}>Cancel</Button>
          </div>
        </div>
      </EditDialog>
    </div>
  );
}
