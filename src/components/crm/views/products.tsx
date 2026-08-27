"use client";
import { useEffect, useState } from "react";
import { api, money } from "@/lib/api-client";
import { useCrmStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Download, Pencil, Trash2 } from "lucide-react";
import { PageHeader, DataTable, StatusBadge } from "../ui";
import { DeleteConfirm, EditDialog } from "../kanban";
import { toast } from "sonner";
import { num } from "@/lib/api-client";

type Product = { id: string; name: string; sku: string; brand?: string | null; purchasePrice: string; sellingPrice: string; wholesalePrice: string; minimumStockLevel: string; status: string; stock: string; damagedStock: string; category?: { name: string } | null };

export function ProductsView() {
  const { navigate } = useCrmStore();
  const [rows, setRows] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(15);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [editForm, setEditForm] = useState({ name: "", sku: "", brand: "", purchasePrice: "0", sellingPrice: "0", status: "ACTIVE" });
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => { api.get<{ items: { id: string; name: string }[] }>("/api/v1/categories?all=true").then((r) => setCategories(r.items)).catch(() => {}); }, []);

  async function load() {
    setLoading(true);
    try {
      const res = await api.get<{ items: Product[]; total: number }>(`/api/v1/products?search=${encodeURIComponent(search)}&page=${page}&limit=${limit}`);
      setRows(res.items); setTotal(res.total);
    } catch (e) { toast.error((e as Error).message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [page]);
  useEffect(() => { setPage(1); load(); }, [search]);

  async function create(data: any) {
    try {
      await api.post("/api/v1/products", data);
      toast.success("Product created");
      setOpen(false); load();
    } catch (e) { toast.error((e as Error).message); }
  }

  return (
    <div>
      <PageHeader title="Products" description="Authoritative product catalog. Costs are read from DB on order creation." action={
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => window.open("/api/v1/exports/products?type=products", "_blank")}><Download className="h-4 w-4 mr-1" /> Export</Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" /> New</Button></DialogTrigger>
            <DialogContent className="max-w-2xl"><ProductForm categories={categories} onCreate={create} /></DialogContent>
          </Dialog>
        </div>
      } />
      <DataTable<Product>
        rows={rows} loading={loading} page={page} totalPages={Math.ceil(total / limit) || 1} total={total} limit={limit}
        onPage={setPage} search={search} onSearch={setSearch} onRowClick={(r) => navigate("products/detail", { id: r.id })}
        columns={[
          { key: "name", header: "Product", render: (r) => <div><div className="font-medium">{r.name}</div><div className="text-xs text-muted-foreground">{r.sku}{r.brand ? ` · ${r.brand}` : ""}</div></div> },
          { key: "category", header: "Category", render: (r) => r.category?.name || "—" },
          { key: "cost", header: "Cost", render: (r) => money(r.purchasePrice) },
          { key: "price", header: "Price", render: (r) => money(r.sellingPrice) },
          { key: "stock", header: "Stock", render: (r) => {
            const s = num(r.stock); const min = num(r.minimumStockLevel);
            const st = s <= 0 ? "OUT_OF_STOCK" : s <= min ? "LOW_STOCK" : "HEALTHY";
            return <div><div className="font-medium">{s}</div><StatusBadge status={st} /></div>;
          } },
          { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
          { key: "actions", header: "", render: (r) => (
            <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditProduct(r); setEditForm({ name: r.name, sku: r.sku, brand: r.brand ?? "", purchasePrice: r.purchasePrice, sellingPrice: r.sellingPrice, status: r.status }); }}><Pencil className="h-3.5 w-3.5" /></Button>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => setDeleteId(r.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
            </div>
          ) },
        ]}
      />

      <DeleteConfirm
        open={!!deleteId}
        onConfirm={async () => { if (deleteId) { try { await api.del(`/api/v1/products/${deleteId}`); toast.success("Product deactivated"); setDeleteId(null); load(); } catch (e) { toast.error((e as Error).message); } } }}
        onCancel={() => setDeleteId(null)}
        title="Deactivate Product"
        message="The product will be deactivated (soft delete). Existing order history is preserved."
      />

      <EditDialog open={!!editProduct} onClose={() => setEditProduct(null)} title={`Edit ${editProduct?.name ?? ""}`}>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Name</Label><Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} /></div>
            <div><Label>SKU</Label><Input value={editForm.sku} onChange={(e) => setEditForm({ ...editForm, sku: e.target.value })} /></div>
          </div>
          <div><Label>Brand</Label><Input value={editForm.brand} onChange={(e) => setEditForm({ ...editForm, brand: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Purchase Price</Label><Input type="number" value={editForm.purchasePrice} onChange={(e) => setEditForm({ ...editForm, purchasePrice: e.target.value })} /></div>
            <div><Label>Selling Price</Label><Input type="number" value={editForm.sellingPrice} onChange={(e) => setEditForm({ ...editForm, sellingPrice: e.target.value })} /></div>
          </div>
          <div><Label>Status</Label>
            <Select value={editForm.status} onValueChange={(v) => setEditForm({ ...editForm, status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="ACTIVE">Active</SelectItem><SelectItem value="INACTIVE">Inactive</SelectItem></SelectContent>
            </Select>
          </div>
          <Button className="w-full" onClick={async () => { if (editProduct) { try { await api.put(`/api/v1/products/${editProduct.id}`, editForm); toast.success("Product updated"); setEditProduct(null); load(); } catch (e) { toast.error((e as Error).message); } } }}>Save Changes</Button>
        </div>
      </EditDialog>
    </div>
  );
}

export function ProductForm({ categories, onCreate, initial }: { categories: { id: string; name: string }[]; onCreate: (data: any) => void; initial?: Partial<Product> }) {
  const [f, setF] = useState({
    sku: initial?.sku ?? "", name: initial?.name ?? "", description: "", categoryId: "", brand: "",
    purchasePrice: initial?.purchasePrice ?? "0", sellingPrice: initial?.sellingPrice ?? "0", wholesalePrice: "0", minimumStockLevel: "0",
    imageUrl: "", status: "ACTIVE",
  });
  return (
    <div>
      <DialogHeader><DialogTitle>New Product</DialogTitle></DialogHeader>
      <div className="space-y-3 py-2 max-h-[70vh] overflow-y-auto pr-1">
        <div className="grid grid-cols-2 gap-3">
          <div><Label>SKU</Label><Input value={f.sku} onChange={(e) => setF({ ...f, sku: e.target.value })} /></div>
          <div><Label>Name</Label><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
        </div>
        <div><Label>Description</Label><Textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Category</Label>
            <Select value={f.categoryId} onValueChange={(v) => setF({ ...f, categoryId: v })}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>{categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Brand</Label><Input value={f.brand} onChange={(e) => setF({ ...f, brand: e.target.value })} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Purchase Price</Label><Input type="number" value={f.purchasePrice} onChange={(e) => setF({ ...f, purchasePrice: e.target.value })} /></div>
          <div><Label>Selling Price</Label><Input type="number" value={f.sellingPrice} onChange={(e) => setF({ ...f, sellingPrice: e.target.value })} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Wholesale Price</Label><Input type="number" value={f.wholesalePrice} onChange={(e) => setF({ ...f, wholesalePrice: e.target.value })} /></div>
          <div><Label>Min Stock Level</Label><Input type="number" value={f.minimumStockLevel} onChange={(e) => setF({ ...f, minimumStockLevel: e.target.value })} /></div>
        </div>
        <Button onClick={() => onCreate(f)} disabled={!f.sku || !f.name}>Create Product</Button>
      </div>
    </div>
  );
}
