"use client";
import { useEffect, useState } from "react";
import { api, money, num } from "@/lib/api-client";
import { useCrmStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Download, History, LayoutDashboard } from "lucide-react";
import { PageHeader, DataTable, StatusBadge } from "../ui";
import { toast } from "sonner";
import { formatDate } from "@/lib/date-range";

type Item = { id: string; name: string; sku: string; category?: string; quantity: string; damagedQuantity: string; minimumStockLevel: string; purchasePrice: string; sellingPrice: string; status: string; stockStatus: string; stockValue: string; retailValue: string };

export function InventoryView() {
  const { params, navigate } = useCrmStore();
  const [rows, setRows] = useState<Item[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(15);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState(params.status || "all");
  const [loading, setLoading] = useState(true);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustProduct, setAdjustProduct] = useState<Item | null>(null);
  const [movementsOpen, setMovementsOpen] = useState(false);
  const [movements, setMovements] = useState<any[]>([]);
  const [movProduct, setMovProduct] = useState<Item | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await api.get<{ items: Item[]; total: number }>(`/api/v1/inventory?search=${encodeURIComponent(search)}&status=${status}&page=${page}&limit=${limit}`);
      setRows(res.items); setTotal(res.total);
    } catch (e) { toast.error((e as Error).message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [page, status]);
  useEffect(() => { setPage(1); load(); }, [search]);

  async function viewMovements(item: Item) {
    setMovProduct(item); setMovementsOpen(true);
    try {
      const res = await api.get<{ items: any[] }>(`/api/v1/inventory/${item.id}`);
      setMovements(res.items);
    } catch (e) { toast.error((e as Error).message); }
  }

  async function adjust(data: any) {
    try {
      await api.post("/api/v1/inventory", data);
      toast.success("Stock adjusted");
      setAdjustOpen(false); load();
    } catch (e) { toast.error((e as Error).message); }
  }

  return (
    <div>
      <PageHeader title="Inventory" description="Ledger-based stock. Every change creates a Stock Movement." action={
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate("inventory/dashboard")}><LayoutDashboard className="h-4 w-4 mr-1" /> Dashboard</Button>
          <Button variant="outline" size="sm" onClick={() => navigate("stock-movements")}><History className="h-4 w-4 mr-1" /> Movements</Button>
          <Button variant="outline" size="sm" onClick={() => window.open("/api/v1/exports/inventory?type=inventory", "_blank")}><Download className="h-4 w-4 mr-1" /> Export</Button>
        </div>
      } />
      <DataTable<Item>
        rows={rows} loading={loading} page={page} totalPages={Math.ceil(total / limit) || 1} total={total} limit={limit}
        onPage={setPage} search={search} onSearch={setSearch}
        toolbar={
          <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All stock</SelectItem>
              <SelectItem value="low">Low stock</SelectItem>
              <SelectItem value="out">Out of stock</SelectItem>
            </SelectContent>
          </Select>
        }
        columns={[
          { key: "name", header: "Product", render: (r) => <div><div className="font-medium">{r.name}</div><div className="text-xs text-muted-foreground">{r.sku}</div></div> },
          { key: "category", header: "Category", render: (r) => r.category || "—" },
          { key: "qty", header: "Stock", render: (r) => <div><div className="font-medium">{num(r.quantity)}</div><div className="text-xs text-muted-foreground">damaged: {num(r.damagedQuantity)}</div></div> },
          { key: "min", header: "Min", render: (r) => r.minimumStockLevel },
          { key: "status", header: "Status", render: (r) => <StatusBadge status={r.stockStatus} /> },
          { key: "value", header: "Stock Value", render: (r) => <div><div>{money(r.stockValue)}</div><div className="text-xs text-muted-foreground">retail {money(r.retailValue)}</div></div> },
          { key: "actions", header: "", render: (r) => (
            <div className="flex gap-1">
              <Button variant="outline" size="sm" className="h-7" onClick={(e) => { e.stopPropagation(); setAdjustProduct(r); setAdjustOpen(true); }}>Adjust</Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); viewMovements(r); }}><History className="h-3.5 w-3.5" /></Button>
            </div>
          ) },
        ]}
      />

      <Dialog open={adjustOpen} onOpenChange={setAdjustOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Adjust Stock — {adjustProduct?.name}</DialogTitle></DialogHeader>
          {adjustProduct && <AdjustForm product={adjustProduct} onSubmit={adjust} />}
        </DialogContent>
      </Dialog>

      <Dialog open={movementsOpen} onOpenChange={setMovementsOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>Stock Movements — {movProduct?.name}</DialogTitle></DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 sticky top-0"><tr><th className="text-left px-2 py-1.5">Date</th><th className="text-left px-2 py-1.5">Type</th><th className="text-right px-2 py-1.5">Change</th><th className="text-right px-2 py-1.5">Prev</th><th className="text-right px-2 py-1.5">New</th><th className="text-left px-2 py-1.5">Reason</th></tr></thead>
              <tbody>
                {movements.map((m) => (
                  <tr key={m.id} className="border-t">
                    <td className="px-2 py-1.5 text-xs">{formatDate(m.createdAt)}</td>
                    <td className="px-2 py-1.5"><StatusBadge status={m.type} /></td>
                    <td className={`px-2 py-1.5 text-right font-medium ${num(m.quantityChange) >= 0 ? "text-emerald-600" : "text-red-600"}`}>{num(m.quantityChange) >= 0 ? "+" : ""}{m.quantityChange}</td>
                    <td className="px-2 py-1.5 text-right">{m.previousQuantity}</td>
                    <td className="px-2 py-1.5 text-right">{m.newQuantity}</td>
                    <td className="px-2 py-1.5 text-xs text-muted-foreground">{m.reason || "—"}</td>
                  </tr>
                ))}
                {movements.length === 0 && <tr><td colSpan={6} className="px-2 py-6 text-center text-muted-foreground">No movements</td></tr>}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AdjustForm({ product, onSubmit }: { product: Item; onSubmit: (data: any) => void }) {
  const [type, setType] = useState("ADJUSTMENT");
  const [qty, setQty] = useState(0);
  const [reason, setReason] = useState("");
  return (
    <div className="space-y-3 py-2">
      <div className="text-sm text-muted-foreground">Current stock: <span className="font-medium text-foreground">{product.quantity}</span> · Damaged: {product.damagedQuantity}</div>
      <div><Label>Type</Label>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ADJUSTMENT">Adjustment (±)</SelectItem>
            <SelectItem value="DAMAGE">Damage (move to damaged)</SelectItem>
            <SelectItem value="TRANSFER_IN">Transfer In (+)</SelectItem>
            <SelectItem value="TRANSFER_OUT">Transfer Out (−)</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div><Label>Quantity Change (use negative for reduction)</Label><Input type="number" value={qty} onChange={(e) => setQty(num(e.target.value))} /></div>
      <div><Label>Reason</Label><Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason for adjustment" /></div>
      <Button onClick={() => onSubmit({ productId: product.id, type, quantityChange: qty, reason })} disabled={qty === 0}>Apply</Button>
    </div>
  );
}
