"use client";
import { useEffect, useState } from "react";
import { api, num } from "@/lib/api-client";
import { useCrmStore } from "@/lib/store";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Plus, ClipboardCheck, Search, Check, X } from "lucide-react";
import { PageHeader, DataTable, StatusBadge, EmptyState } from "../ui";
import { toast } from "sonner";
import { formatDate } from "@/lib/date-range";

type SC = { id: string; countNumber: string; status: string; warehouse?: { name: string } | null; notes?: string | null; creator?: { name: string } | null; approver?: { name: string } | null; _count?: { items: number }; createdAt: string };

export function StockCountsView() {
  const { params, navigate } = useCrmStore();
  // If an id is selected, show the detail view
  if (params.id) return <StockCountDetail id={params.id} onBack={() => navigate("stock-counts", {})} />;
  return <StockCountList />;
}

function StockCountList() {
  const { navigate } = useCrmStore();
  const [rows, setRows] = useState<SC[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(15);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [warehouses, setWarehouses] = useState<{ id: string; name: string }[]>([]);

  async function load() {
    setLoading(true);
    try {
      const res = await api.get<{ items: SC[]; total: number }>(`/api/v1/stock-counts?page=${page}&limit=${limit}`);
      setRows(res.items); setTotal(res.total);
    } catch (e) { toast.error((e as Error).message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [page]);
  useEffect(() => { api.get<{ items: { id: string; name: string }[] }>("/api/v1/warehouses").then((r) => setWarehouses(r.items)).catch(() => {}); }, []);

  async function create(data: any) {
    try { await api.post("/api/v1/stock-counts", data); toast.success("Stock count created"); setOpen(false); load(); }
    catch (e) { toast.error((e as Error).message); }
  }

  return (
    <div>
      <PageHeader title="Stock Counts (Reconciliation)" description="Physical counts with an approval workflow. Approved counts apply ADJUSTMENT movements via the InventoryService." action={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" /> New Count</Button></DialogTrigger>
          <DialogContent className="max-w-2xl"><StockCountForm warehouses={warehouses} onCreate={create} /></DialogContent>
        </Dialog>
      } />
      {rows.length === 0 ? (
        <EmptyState icon={ClipboardCheck} title="No stock counts yet" description="Create a physical count to reconcile system vs counted quantities." action={
          <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" /> New Count</Button>
        } />
      ) : (
        <DataTable<SC>
          rows={rows} loading={loading} page={page} totalPages={Math.ceil(total / limit) || 1} total={total} limit={limit}
          onPage={setPage}
          onRowClick={(r) => navigate("stock-counts", { id: r.id })}
          columns={[
            { key: "countNumber", header: "Count #", render: (r) => <span className="font-medium">{r.countNumber}</span> },
            { key: "warehouse", header: "Warehouse", render: (r) => r.warehouse?.name ?? "Default" },
            { key: "items", header: "Items", render: (r) => r._count?.items ?? 0 },
            { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
            { key: "creator", header: "Created By", render: (r) => r.creator?.name ?? "—" },
            { key: "approver", header: "Approved By", render: (r) => r.approver?.name ?? "—" },
            { key: "date", header: "Date", render: (r) => <span className="text-xs text-muted-foreground">{formatDate(r.createdAt)}</span> },
          ]}
        />
      )}
    </div>
  );
}

function StockCountForm({ warehouses, onCreate }: { warehouses: { id: string; name: string }[]; onCreate: (data: any) => void }) {
  const [warehouseId, setWarehouseId] = useState(warehouses[0]?.id ?? "");
  const [notes, setNotes] = useState("");
  const [prodSearch, setProdSearch] = useState("");
  const [products, setProducts] = useState<{ id: string; name: string; sku: string }[]>([]);
  const [lines, setLines] = useState<{ productId: string; name: string; countedQuantity: number }[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const t = setTimeout(async () => {
      const r = await api.get<{ items: any[] }>(`/api/v1/products?search=${encodeURIComponent(prodSearch)}&limit=10`);
      setProducts(r.items.map((p) => ({ id: p.id, name: p.name, sku: p.sku })));
    }, 300);
    return () => clearTimeout(t);
  }, [prodSearch]);

  async function submit() {
    setSaving(true);
    try {
      await onCreate({ warehouseId: warehouseId || undefined, notes: notes || undefined, items: lines.map((l) => ({ productId: l.productId, countedQuantity: String(l.countedQuantity) })) });
      setLines([]); setNotes(""); setProdSearch("");
    } finally { setSaving(false); }
  }

  return (
    <div>
      <DialogHeader><DialogTitle>New Stock Count</DialogTitle></DialogHeader>
      <div className="space-y-3 py-2 max-h-[70vh] overflow-y-auto pr-1">
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Warehouse</Label>
            <select className="w-full rounded-md border border-border bg-background px-3 h-9 text-sm" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
              <option value="">Default</option>
              {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>
          <div><Label>Notes</Label><Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Reference / reason" /></div>
        </div>
        <div><Label>Products to count</Label>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-8" value={prodSearch} onChange={(e) => setProdSearch(e.target.value)} placeholder="Search products…" />
            {products.length > 0 && (
              <div className="absolute z-10 mt-1 w-full rounded-md border bg-popover shadow-md max-h-48 overflow-y-auto">
                {products.map((p) => (
                  <button key={p.id} onClick={() => { if (!lines.find((l) => l.productId === p.id)) setLines((ls) => [...ls, { productId: p.id, name: p.name, countedQuantity: 0 }]); setProdSearch(""); setProducts([]); }} className="block w-full text-left px-2 py-1.5 hover:bg-accent border-b last:border-0 text-sm">
                    <div className="font-medium">{p.name}</div><div className="text-xs text-muted-foreground">{p.sku}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        {lines.length > 0 && (
          <div className="rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50"><tr><th className="text-left px-2 py-1.5">Product</th><th className="text-right px-2 py-1.5">Counted Qty</th><th></th></tr></thead>
              <tbody>
                {lines.map((l) => (
                  <tr key={l.productId} className="border-t">
                    <td className="px-2 py-1.5 font-medium">{l.name}</td>
                    <td className="px-2 py-1.5 text-right"><Input type="number" min="0" value={l.countedQuantity} onChange={(e) => setLines((ls) => ls.map((x) => x.productId === l.productId ? { ...x, countedQuantity: num(e.target.value) } : x))} className="w-24 h-8 text-right" /></td>
                    <td className="px-2 py-1.5"><Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setLines((ls) => ls.filter((x) => x.productId !== l.productId))}><X className="h-3.5 w-3.5" /></Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Button onClick={submit} disabled={saving || lines.length === 0}>Create Count</Button>
      </div>
    </div>
  );
}

function StockCountDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const [sc, setSc] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try { setSc(await api.get(`/api/v1/stock-counts/${id}`)); }
    catch (e) { toast.error((e as Error).message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [id]);

  async function action(a: "submit" | "approve" | "reject") {
    try { await api.post(`/api/v1/stock-counts/${id}`, { action: a }); toast.success(`${a} done`); load(); }
    catch (e) { toast.error((e as Error).message); }
  }
  async function updateItem(productId: string, qty: number) {
    try { await api.post(`/api/v1/stock-counts/${id}`, { action: "addItem", productId, countedQuantity: qty }); load(); }
    catch (e) { toast.error((e as Error).message); }
  }

  if (loading) return <div className="p-8 text-center text-muted-foreground">Loading…</div>;
  if (!sc) return <div className="p-8 text-center">Not found</div>;

  return (
    <div>
      <PageHeader title={`Stock Count ${sc.countNumber}`} description={`${sc.warehouse?.name ?? "Default"} · ${sc.status}`} action={
        <div className="flex gap-2">
          {sc.status === "DRAFT" && <Button size="sm" onClick={() => action("submit")}>Submit for Approval</Button>}
          {sc.status === "PENDING_APPROVAL" && <>
            <Button size="sm" onClick={() => action("approve")}><Check className="h-4 w-4 mr-1" /> Approve & Apply Adjustments</Button>
            <Button size="sm" variant="outline" onClick={() => action("reject")}>Reject</Button>
          </>}
          <Button size="sm" variant="ghost" onClick={onBack}>Back</Button>
        </div>
      } />
      <div className="rounded-xl border border-border/80 overflow-hidden bg-card shadow-soft">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr><th className="text-left font-semibold text-muted-foreground px-4 py-3 text-xs uppercase tracking-wider">Product</th><th className="text-right font-semibold text-muted-foreground px-4 py-3 text-xs uppercase tracking-wider">System Qty</th><th className="text-right font-semibold text-muted-foreground px-4 py-3 text-xs uppercase tracking-wider">Counted Qty</th><th className="text-right font-semibold text-muted-foreground px-4 py-3 text-xs uppercase tracking-wider">Difference</th></tr>
            </thead>
            <tbody>
              {sc.items?.map((it: any) => {
                const diff = num(it.difference);
                return (
                  <tr key={it.id} className="border-t border-border/60 hover:bg-muted/30">
                    <td className="px-4 py-3"><div className="font-medium">{it.product?.name}</div><div className="text-xs text-muted-foreground">{it.product?.sku}</div></td>
                    <td className="px-4 py-3 text-right tabular-nums">{it.systemQuantity}</td>
                    <td className="px-4 py-3 text-right">
                      {sc.status === "DRAFT" ? <Input type="number" defaultValue={num(it.countedQuantity)} onBlur={(e) => updateItem(it.productId, num(e.target.value))} className="w-24 h-8 text-right ml-auto" /> : <span className="tabular-nums">{it.countedQuantity}</span>}
                    </td>
                    <td className={`px-4 py-3 text-right font-medium tabular-nums ${diff > 0 ? "text-emerald-600" : diff < 0 ? "text-red-600" : "text-muted-foreground"}`}>{diff > 0 ? "+" : ""}{it.difference}</td>
                  </tr>
                );
              })}
              {(!sc.items || sc.items.length === 0) && <tr><td colSpan={4} className="px-4 py-10 text-center text-muted-foreground text-sm">No items in this count</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      {sc.status === "APPROVED" && <p className="text-xs text-emerald-600 mt-3 flex items-center gap-1"><Check className="h-3.5 w-3.5" /> Approved — ADJUSTMENT movements applied to inventory.</p>}
    </div>
  );
}
