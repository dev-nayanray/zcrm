"use client";
import { useEffect, useState } from "react";
import { api, money, num } from "@/lib/api-client";
import { useCrmStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Download, Trash2, Search } from "lucide-react";
import { PageHeader, DataTable, StatusBadge } from "../ui";
import { toast } from "sonner";
import { formatDate } from "@/lib/date-range";

type Purchase = { id: string; purchaseNumber: string; status: string; paymentStatus: string; total: string; paidAmount: string; dueAmount: string; itemCount: number; supplier: { id: string; name: string; company?: string | null }; createdAt: string };

export function PurchasesView() {
  const { navigate } = useCrmStore();
  const [rows, setRows] = useState<Purchase[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(15);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [returnPurchase, setReturnPurchase] = useState<Purchase | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await api.get<{ items: Purchase[]; total: number }>(`/api/v1/purchases?search=${encodeURIComponent(search)}&page=${page}&limit=${limit}`);
      setRows(res.items); setTotal(res.total);
    } catch (e) { toast.error((e as Error).message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [page]);
  useEffect(() => { setPage(1); load(); }, [search]);

  async function receive(id: string) {
    try { await api.patch(`/api/v1/purchases/${id}?action=receive`); toast.success("Received"); load(); }
    catch (e) { toast.error((e as Error).message); }
  }

  return (
    <div>
      <PageHeader title="Purchases" description="Supplier purchases. Receiving increases stock via Stock Movements." action={
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => window.open("/api/v1/exports/purchases?type=purchases", "_blank")}><Download className="h-4 w-4 mr-1" /> Export</Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" /> New</Button></DialogTrigger>
            <DialogContent className="max-w-3xl"><PurchaseForm onCreate={async () => { setOpen(false); load(); }} /></DialogContent>
          </Dialog>
        </div>
      } />
      <DataTable<Purchase>
        rows={rows} loading={loading} page={page} totalPages={Math.ceil(total / limit) || 1} total={total} limit={limit}
        onPage={setPage} search={search} onSearch={setSearch}
        columns={[
          { key: "purchaseNumber", header: "Purchase #", render: (r) => <div className="font-medium">{r.purchaseNumber}</div> },
          { key: "supplier", header: "Supplier", render: (r) => <div><div className="font-medium">{r.supplier.name}</div><div className="text-xs text-muted-foreground">{r.supplier.company}</div></div> },
          { key: "total", header: "Total", render: (r) => money(r.total) },
          { key: "paid", header: "Paid", render: (r) => money(r.paidAmount) },
          { key: "due", header: "Due", render: (r) => <span className={num(r.dueAmount) > 0 ? "text-amber-600 font-medium" : ""}>{money(r.dueAmount)}</span> },
          { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
          { key: "payment", header: "Payment", render: (r) => <StatusBadge status={r.paymentStatus} /> },
          { key: "date", header: "Date", render: (r) => <span className="text-xs text-muted-foreground">{formatDate(r.createdAt)}</span> },
          { key: "actions", header: "", render: (r) => (
            <div className="flex gap-1">
              {r.status === "PENDING" && <Button variant="outline" size="sm" className="h-7" onClick={(e) => { e.stopPropagation(); receive(r.id); }}>Receive</Button>}
              {r.status === "RECEIVED" && <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={(e) => { e.stopPropagation(); setReturnPurchase(r); }}>Return</Button>}
            </div>
          ) },
        ]}
      />
      {returnPurchase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setReturnPurchase(null)}>
          <Card className="w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <CardContent className="p-4">
              <PurchaseReturnForm purchaseId={returnPurchase.id} purchaseNumber={returnPurchase.purchaseNumber} onDone={() => { setReturnPurchase(null); load(); }} />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function PurchaseForm({ onCreate }: { onCreate: () => void }) {
  const [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>([]);
  const [products, setProducts] = useState<{ id: string; name: string; sku: string; purchasePrice: string }[]>([]);
  const [supplierId, setSupplierId] = useState("");
  const [discount, setDiscount] = useState(0);
  const [shippingCost, setShippingCost] = useState(0);
  const [paidAmount, setPaidAmount] = useState(0);
  const [notes, setNotes] = useState("");
  const [prodSearch, setProdSearch] = useState("");
  const [lines, setLines] = useState<{ productId: string; name: string; quantity: number; unitCost: number }[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => { api.get<{ items: { id: string; name: string }[] }>("/api/v1/suppliers?limit=200").then((r) => setSuppliers(r.items)).catch(() => {}); }, []);
  useEffect(() => {
    const t = setTimeout(async () => {
      const r = await api.get<{ items: any[] }>(`/api/v1/products?search=${encodeURIComponent(prodSearch)}&limit=8`);
      setProducts(r.items.map((p) => ({ id: p.id, name: p.name, sku: p.sku, purchasePrice: p.purchasePrice })));
    }, 300);
    return () => clearTimeout(t);
  }, [prodSearch]);

  const subtotal = lines.reduce((s, l) => s + l.quantity * l.unitCost, 0);
  const total = subtotal - discount + shippingCost;

  async function save() {
    if (!supplierId) { toast.error("Select a supplier"); return; }
    if (lines.length === 0) { toast.error("Add at least one product"); return; }
    setSaving(true);
    try {
      await api.post("/api/v1/purchases", {
        supplierId, discount: String(discount), shippingCost: String(shippingCost), paidAmount: String(paidAmount), notes,
        items: lines.map((l) => ({ productId: l.productId, quantity: String(l.quantity), unitCost: String(l.unitCost) })),
        receive: true,
      });
      toast.success("Purchase created");
      onCreate();
    } catch (e) { toast.error((e as Error).message); }
    finally { setSaving(false); }
  }

  return (
    <div>
      <DialogHeader><DialogTitle>New Purchase</DialogTitle></DialogHeader>
      <div className="space-y-3 py-2 max-h-[75vh] overflow-y-auto pr-1">
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Supplier</Label>
            <Select value={supplierId} onValueChange={setSupplierId}><SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
              <SelectContent>{suppliers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Notes</Label><Input value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        </div>
        <div>
          <Label>Search products</Label>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-8" value={prodSearch} onChange={(e) => setProdSearch(e.target.value)} placeholder="Add products to purchase…" />
            {products.length > 0 && (
              <div className="absolute z-10 mt-1 w-full rounded-md border bg-popover shadow-md max-h-60 overflow-y-auto">
                {products.map((p) => (
                  <button key={p.id} onClick={() => { if (lines.find((l) => l.productId === p.id)) setLines((ls) => ls.map((l) => l.productId === p.id ? { ...l, quantity: l.quantity + 1 } : l)); else setLines((ls) => [...ls, { productId: p.id, name: p.name, quantity: 1, unitCost: num(p.purchasePrice) }]); setProdSearch(""); setProducts([]); }} className="block w-full text-left px-3 py-2 hover:bg-accent border-b last:border-0">
                    <div className="font-medium text-sm">{p.name}</div>
                    <div className="text-xs text-muted-foreground">{p.sku} · cost {money(p.purchasePrice)}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        {lines.length > 0 && (
          <div className="rounded-md border overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50"><tr><th className="text-left px-2 py-1.5">Product</th><th className="text-right px-2 py-1.5">Qty</th><th className="text-right px-2 py-1.5">Unit Cost</th><th className="text-right px-2 py-1.5">Total</th><th></th></tr></thead>
              <tbody>
                {lines.map((l) => (
                  <tr key={l.productId} className="border-t">
                    <td className="px-2 py-1.5 font-medium">{l.name}</td>
                    <td className="px-2 py-1.5 text-right"><Input type="number" min="1" value={l.quantity} onChange={(e) => setLines((ls) => ls.map((x) => x.productId === l.productId ? { ...x, quantity: Math.max(1, num(e.target.value)) } : x))} className="w-16 h-8 text-right" /></td>
                    <td className="px-2 py-1.5 text-right"><Input type="number" min="0" value={l.unitCost} onChange={(e) => setLines((ls) => ls.map((x) => x.productId === l.productId ? { ...x, unitCost: Math.max(0, num(e.target.value)) } : x))} className="w-20 h-8 text-right" /></td>
                    <td className="px-2 py-1.5 text-right font-medium">{money(l.quantity * l.unitCost)}</td>
                    <td className="px-2 py-1.5"><Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setLines((ls) => ls.filter((x) => x.productId !== l.productId))}><Trash2 className="h-3.5 w-3.5" /></Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="grid grid-cols-3 gap-3">
          <div><Label>Discount</Label><Input type="number" value={discount} onChange={(e) => setDiscount(Math.max(0, num(e.target.value)))} /></div>
          <div><Label>Shipping</Label><Input type="number" value={shippingCost} onChange={(e) => setShippingCost(Math.max(0, num(e.target.value)))} /></div>
          <div><Label>Paid Amount</Label><Input type="number" value={paidAmount} onChange={(e) => setPaidAmount(Math.max(0, num(e.target.value)))} /></div>
        </div>
        <div className="flex justify-between border-t pt-2 font-bold"><span>Total</span><span>{money(total)}</span></div>
        <Button onClick={save} disabled={saving}>Create Purchase</Button>
      </div>
    </div>
  );
}

function PurchaseReturnForm({ purchaseId, purchaseNumber, onDone }: { purchaseId: string; purchaseNumber: string; onDone: () => void }) {
  const [items, setItems] = useState<any[]>([]);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get<any>(`/api/v1/purchases/${purchaseId}`).then((r) => {
      const mapped = (r.items ?? []).map((it: any) => ({
        productId: it.productId,
        name: it.product?.name ?? it.productName,
        sku: it.product?.sku ?? it.sku,
        max: num(it.quantity),
        quantity: 0,
      }));
      setItems(mapped);
    }).catch(() => {});
  }, [purchaseId]);

  async function submit() {
    const toReturn = items.filter((i) => i.quantity > 0);
    if (toReturn.length === 0) return;
    setSaving(true);
    try {
      await api.post("/api/v1/purchase-returns", { purchaseId, reason: reason || undefined, items: toReturn.map((i) => ({ productId: i.productId, quantity: String(i.quantity) })) });
      toast.success("Purchase return processed — stock adjusted");
      onDone();
    } catch (e) { toast.error((e as Error).message); }
    finally { setSaving(false); }
  }

  return (
    <div>
      <DialogHeader><DialogTitle>Return to Supplier — {purchaseNumber}</DialogTitle></DialogHeader>
      <div className="space-y-3 py-2">
        <p className="text-xs text-muted-foreground">Select items and quantities to return. Stock will be reduced via TRANSFER_OUT movements (fully traceable).</p>
        <div className="rounded-md border max-h-60 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 sticky top-0"><tr><th className="text-left px-2 py-1.5 text-xs uppercase text-muted-foreground">Product</th><th className="text-right px-2 py-1.5 text-xs uppercase text-muted-foreground">Received</th><th className="text-right px-2 py-1.5 text-xs uppercase text-muted-foreground">Return Qty</th></tr></thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.productId} className="border-t">
                  <td className="px-2 py-1.5"><div className="font-medium">{it.name}</div><div className="text-xs text-muted-foreground">{it.sku}</div></td>
                  <td className="px-2 py-1.5 text-right">{it.max}</td>
                  <td className="px-2 py-1.5 text-right"><Input type="number" min="0" max={it.max} value={it.quantity || ""} onChange={(e) => setItems((ls) => ls.map((x) => x.productId === it.productId ? { ...x, quantity: Math.min(it.max, num(e.target.value)) } : x))} className="w-20 h-8 text-right" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div><Label>Reason</Label><Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Damaged / wrong item / etc." /></div>
        <Button onClick={submit} disabled={saving || items.every((i) => i.quantity === 0)}>Process Return</Button>
      </div>
    </div>
  );
}
