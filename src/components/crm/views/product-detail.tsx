"use client";
import { useEffect, useState } from "react";
import { api, money, num } from "@/lib/api-client";
import { useCrmStore } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Package, Plus, Barcode } from "lucide-react";
import { PageHeader, StatusBadge } from "../ui";
import { toast } from "sonner";
import { formatDate } from "@/lib/date-range";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Detail = any;

export function ProductDetailView() {
  const { params, navigate } = useCrmStore();
  const [data, setData] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [variants, setVariants] = useState<any[]>([]);
  const [varOpen, setVarOpen] = useState(false);

  async function loadVariants() {
    if (!params.id) return;
    try { const r = await api.get<{ items: any[] }>(`/api/v1/product-variants?productId=${params.id}`); setVariants(r.items); } catch { setVariants([]); }
  }

  async function load() {
    if (!params.id) return;
    setLoading(true);
    try {
      const r = await api.get<Detail>(`/api/v1/products/${params.id}`);
      setData(r);
    } catch (e) { toast.error((e as Error).message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); loadVariants(); }, [params.id]);

  if (loading) return <div className="p-8 text-center text-muted-foreground">Loading…</div>;
  if (!data) return <div className="p-8 text-center">Not found</div>;

  const stock = num(data.stock);
  const min = num(data.minimumStockLevel);
  const status = stock <= 0 ? "OUT_OF_STOCK" : stock <= min ? "LOW_STOCK" : "HEALTHY";

  return (
    <div>
      <PageHeader title={data.name} description={`${data.sku}${data.brand ? ` · ${data.brand}` : ""}`} action={
        <Button variant="ghost" size="sm" onClick={() => navigate("products")}><ArrowLeft className="h-4 w-4 mr-1" /> Back</Button>
      } />
      <div className="grid lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Package className="h-4 w-4" /> Product Details</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            <Row label="SKU" value={data.sku} />
            <Row label="Brand" value={data.brand || "—"} />
            <Row label="Category" value={data.category?.name || "—"} />
            <Row label="Status" value={<StatusBadge status={data.status} />} />
            {data.description && <div className="pt-2 text-xs text-muted-foreground">{data.description}</div>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Pricing</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            <Row label="Purchase Price" value={money(data.purchasePrice)} />
            <Row label="Selling Price" value={money(data.sellingPrice)} />
            <Row label="Wholesale Price" value={money(data.wholesalePrice)} />
            <Row label="Min Stock Level" value={data.minimumStockLevel} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Stock</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            <Row label="Available" value={data.stock} />
            <Row label="Damaged" value={data.damagedStock} />
            <Row label="Stock Value (cost)" value={money(num(data.stock) * num(data.purchasePrice))} />
            <div className="pt-2"><StatusBadge status={status} /></div>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-4 mt-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Recent Sales</CardTitle></CardHeader>
          <CardContent>
            <div className="rounded-md border overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50"><tr><th className="text-left px-2 py-1.5">Order</th><th className="text-right px-2 py-1.5">Qty</th><th className="text-right px-2 py-1.5">Price</th><th className="text-left px-2 py-1.5">Date</th></tr></thead>
                <tbody>
                  {data.sales?.map((s: any) => (
                    <tr key={s.id} className="border-t hover:bg-muted/40 cursor-pointer" onClick={() => navigate("orders/detail", { id: s.orderId })}>
                      <td className="px-2 py-1.5 font-medium">{s.order?.orderNumber}</td>
                      <td className="px-2 py-1.5 text-right">{s.quantity}</td>
                      <td className="px-2 py-1.5 text-right">{money(s.unitPrice)}</td>
                      <td className="px-2 py-1.5 text-xs text-muted-foreground">{formatDate(s.createdAt)}</td>
                    </tr>
                  ))}
                  {(!data.sales || data.sales.length === 0) && <tr><td colSpan={4} className="px-2 py-4 text-center text-muted-foreground">No sales yet</td></tr>}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Recent Purchases</CardTitle></CardHeader>
          <CardContent>
            <div className="rounded-md border overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50"><tr><th className="text-left px-2 py-1.5">Purchase</th><th className="text-right px-2 py-1.5">Qty</th><th className="text-right px-2 py-1.5">Unit Cost</th><th className="text-left px-2 py-1.5">Date</th></tr></thead>
                <tbody>
                  {data.purchases?.map((p: any) => (
                    <tr key={p.id} className="border-t hover:bg-muted/40 cursor-pointer" onClick={() => navigate("purchases", {})}>
                      <td className="px-2 py-1.5 font-medium">{p.purchase?.purchaseNumber}</td>
                      <td className="px-2 py-1.5 text-right">{p.quantity}</td>
                      <td className="px-2 py-1.5 text-right">{money(p.unitCost)}</td>
                      <td className="px-2 py-1.5 text-xs text-muted-foreground">{formatDate(p.createdAt)}</td>
                    </tr>
                  ))}
                  {(!data.purchases || data.purchases.length === 0) && <tr><td colSpan={4} className="px-2 py-4 text-center text-muted-foreground">No purchases yet</td></tr>}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Product Variants + Barcode */}
      <Card className="mt-4">
        <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base flex items-center gap-2"><Barcode className="h-4 w-4" /> Product Variants</CardTitle>
          <Dialog open={varOpen} onOpenChange={setVarOpen}>
            <DialogTrigger asChild><Button size="sm" variant="outline"><Plus className="h-4 w-4 mr-1" /> Add Variant</Button></DialogTrigger>
            <DialogContent><VariantForm productId={params.id} onCreate={async (d) => { try { await api.post("/api/v1/product-variants", d); toast.success("Variant added"); setVarOpen(false); loadVariants(); } catch (e) { toast.error((e as Error).message); } }} /></DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {variants.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No variants — this product has a single SKU. Add variants (e.g. Red/L, Blue/M) for size/color variations.</p>
          ) : (
            <div className="rounded-md border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/40"><tr><th className="text-left px-3 py-2 text-xs uppercase tracking-wider text-muted-foreground font-semibold">SKU</th><th className="text-left px-3 py-2 text-xs uppercase tracking-wider text-muted-foreground font-semibold">Barcode</th><th className="text-left px-3 py-2 text-xs uppercase tracking-wider text-muted-foreground font-semibold">Name</th><th className="text-right px-3 py-2 text-xs uppercase tracking-wider text-muted-foreground font-semibold">Cost</th><th className="text-right px-3 py-2 text-xs uppercase tracking-wider text-muted-foreground font-semibold">Price</th></tr></thead>
                <tbody>
                  {variants.map((v) => (
                    <tr key={v.id} className="border-t hover:bg-muted/30">
                      <td className="px-3 py-2 font-mono text-xs">{v.sku}</td>
                      <td className="px-3 py-2 text-xs font-mono">{v.barcode ?? "—"}</td>
                      <td className="px-3 py-2">{v.name}</td>
                      <td className="px-3 py-2 text-right">{money(v.purchasePrice)}</td>
                      <td className="px-3 py-2 text-right font-medium">{money(v.sellingPrice)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function VariantForm({ productId, onCreate }: { productId: string; onCreate: (d: any) => void }) {
  const [f, setF] = useState({ sku: "", barcode: "", name: "", purchasePrice: "0", sellingPrice: "0" });
  return (
    <div>
      <DialogHeader><DialogTitle>Add Variant</DialogTitle></DialogHeader>
      <div className="space-y-3 py-2">
        <div className="grid grid-cols-2 gap-3">
          <div><Label>SKU</Label><Input value={f.sku} onChange={(e) => setF({ ...f, sku: e.target.value })} /></div>
          <div><Label>Barcode</Label><Input value={f.barcode} onChange={(e) => setF({ ...f, barcode: e.target.value })} placeholder="EAN/UPC (optional)" /></div>
        </div>
        <div><Label>Variant Name</Label><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Red / Large" /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Purchase Price</Label><Input type="number" value={f.purchasePrice} onChange={(e) => setF({ ...f, purchasePrice: e.target.value })} /></div>
          <div><Label>Selling Price</Label><Input type="number" value={f.sellingPrice} onChange={(e) => setF({ ...f, sellingPrice: e.target.value })} /></div>
        </div>
        <Button onClick={() => onCreate({ ...f, productId, barcode: f.barcode || undefined })} disabled={!f.sku || !f.name}>Add Variant</Button>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="flex justify-between"><span className="text-muted-foreground">{label}</span><span className="font-medium">{value}</span></div>;
}
