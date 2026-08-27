"use client";
import { useEffect, useState } from "react";
import { api, num } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, ArrowRightLeft, Trash2, Search } from "lucide-react";
import { PageHeader, DataTable, StatusBadge } from "../ui";
import { toast } from "sonner";
import { formatDate } from "@/lib/date-range";

type Transfer = { id: string; transferNumber: string; status: string; fromWarehouse: { name: string }; toWarehouse: { name: string }; notes?: string | null; createdAt: string; _count?: { items: number } };

export function StockTransfersView() {
  const [rows, setRows] = useState<Transfer[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(15);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await api.get<{ items: Transfer[]; total: number }>(`/api/v1/stock-transfers?page=${page}&limit=${limit}`);
      setRows(res.items); setTotal(res.total);
    } catch (e) { toast.error((e as Error).message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [page]);

  return (
    <div>
      <PageHeader title="Stock Transfers" description="Move stock between warehouses. Every transfer records TRANSFER_OUT + TRANSFER_IN movements." action={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" /> New Transfer</Button></DialogTrigger>
          <DialogContent className="max-w-2xl"><TransferForm onCreate={() => { setOpen(false); load(); }} /></DialogContent>
        </Dialog>
      } />
      <DataTable<Transfer>
        rows={rows} loading={loading} page={page} totalPages={Math.ceil(total / limit) || 1} total={total} limit={limit}
        onPage={setPage}
        columns={[
          { key: "transferNumber", header: "Transfer #", render: (r) => <div className="font-medium">{r.transferNumber}</div> },
          { key: "route", header: "Route", render: (r) => <div className="flex items-center gap-1 text-sm"><span>{r.fromWarehouse.name}</span><ArrowRightLeft className="h-3 w-3 text-muted-foreground" /><span>{r.toWarehouse.name}</span></div> },
          { key: "items", header: "Items", render: (r) => r._count?.items ?? 0 },
          { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
          { key: "date", header: "Date", render: (r) => <span className="text-xs text-muted-foreground">{formatDate(r.createdAt)}</span> },
        ]}
      />
    </div>
  );
}

function TransferForm({ onCreate }: { onCreate: () => void }) {
  const [warehouses, setWarehouses] = useState<{ id: string; name: string }[]>([]);
  const [products, setProducts] = useState<{ id: string; name: string; sku: string; sellingPrice: string; stock: string }[]>([]);
  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");
  const [notes, setNotes] = useState("");
  const [prodSearch, setProdSearch] = useState("");
  const [lines, setLines] = useState<{ productId: string; name: string; quantity: number }[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => { api.get<{ items: { id: string; name: string }[] }>("/api/v1/warehouses").then((r) => { setWarehouses(r.items); if (r.items[0]) setFromId(r.items[0].id); if (r.items[1]) setToId(r.items[1].id); else if (r.items[0]) setToId(r.items[0].id); }).catch(() => {}); }, []);
  useEffect(() => {
    const t = setTimeout(async () => {
      const r = await api.get<{ items: any[] }>(`/api/v1/products?search=${encodeURIComponent(prodSearch)}&limit=8`);
      setProducts(r.items.map((p) => ({ id: p.id, name: p.name, sku: p.sku, sellingPrice: p.sellingPrice, stock: p.stock })));
    }, 300);
    return () => clearTimeout(t);
  }, [prodSearch]);

  async function save() {
    if (!fromId || !toId) { toast.error("Select source and destination"); return; }
    if (lines.length === 0) { toast.error("Add at least one product"); return; }
    setSaving(true);
    try {
      await api.post("/api/v1/stock-transfers", { fromWarehouseId: fromId, toWarehouseId: toId, notes, items: lines.map((l) => ({ productId: l.productId, quantity: String(l.quantity) })) });
      toast.success("Transfer completed — stock movements recorded");
      onCreate();
    } catch (e) { toast.error((e as Error).message); }
    finally { setSaving(false); }
  }

  return (
    <div>
      <DialogHeader><DialogTitle>New Stock Transfer</DialogTitle></DialogHeader>
      <div className="space-y-3 py-2 max-h-[70vh] overflow-y-auto pr-1">
        <div className="grid grid-cols-2 gap-3">
          <div><Label>From</Label>
            <Select value={fromId} onValueChange={setFromId}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{warehouses.map((w) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}</SelectContent></Select>
          </div>
          <div><Label>To</Label>
            <Select value={toId} onValueChange={setToId}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{warehouses.map((w) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}</SelectContent></Select>
          </div>
        </div>
        <div><Label>Notes</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        <div><Label>Products</Label>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-8" value={prodSearch} onChange={(e) => setProdSearch(e.target.value)} placeholder="Search products…" />
            {products.length > 0 && (
              <div className="absolute z-10 mt-1 w-full rounded-md border bg-popover shadow-md max-h-48 overflow-y-auto">
                {products.map((p) => (
                  <button key={p.id} onClick={() => { if (lines.find((l) => l.productId === p.id)) setLines((ls) => ls.map((l) => l.productId === p.id ? { ...l, quantity: l.quantity + 1 } : l)); else setLines((ls) => [...ls, { productId: p.id, name: p.name, quantity: 1 }]); setProdSearch(""); setProducts([]); }} className="block w-full text-left px-2 py-1.5 hover:bg-accent border-b last:border-0 text-sm">
                    <div className="font-medium">{p.name}</div><div className="text-xs text-muted-foreground">{p.sku} · stock {p.stock}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        {lines.length > 0 && (
          <div className="rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50"><tr><th className="text-left px-2 py-1.5">Product</th><th className="text-right px-2 py-1.5">Qty</th><th></th></tr></thead>
              <tbody>
                {lines.map((l) => (
                  <tr key={l.productId} className="border-t">
                    <td className="px-2 py-1.5 font-medium">{l.name}</td>
                    <td className="px-2 py-1.5 text-right"><Input type="number" min="1" value={l.quantity} onChange={(e) => setLines((ls) => ls.map((x) => x.productId === l.productId ? { ...x, quantity: Math.max(1, num(e.target.value)) } : x))} className="w-20 h-8 text-right" /></td>
                    <td className="px-2 py-1.5"><Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setLines((ls) => ls.filter((x) => x.productId !== l.productId))}><Trash2 className="h-3.5 w-3.5" /></Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Button onClick={save} disabled={saving}>Create Transfer</Button>
      </div>
    </div>
  );
}
