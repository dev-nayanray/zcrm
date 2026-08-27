"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { PageHeader, DataTable, StatusBadge } from "../ui";
import { toast } from "sonner";
import { useCrmStore } from "@/lib/store";

type Category = { id: string; name: string; slug: string; status: string; sortOrder: number; parent?: { name: string } | null; _count?: { products: number; children: number } };

export function CategoriesView() {
  const [rows, setRows] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await api.get<{ items: Category[] }>("/api/v1/categories?all=true");
      setRows(res.items);
    } catch (e) { toast.error((e as Error).message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function create(data: any) {
    try {
      await api.post("/api/v1/categories", data);
      toast.success("Category created");
      setOpen(false); load();
    } catch (e) { toast.error((e as Error).message); }
  }

  async function del(id: string) {
    if (!confirm("Delete this category?")) return;
    try { await api.del(`/api/v1/categories/${id}`); toast.success("Deleted"); load(); }
    catch (e) { toast.error((e as Error).message); }
  }

  return (
    <div>
      <PageHeader title="Categories" description="Organize products with nested categories." action={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" /> New</Button></DialogTrigger>
          <DialogContent><CategoryForm categories={rows} onCreate={create} /></DialogContent>
        </Dialog>
      } />
      <DataTable<Category>
        rows={rows} loading={loading} page={1} totalPages={1} total={rows.length} limit={rows.length}
        columns={[
          { key: "name", header: "Name", render: (r) => <div><div className="font-medium">{r.name}</div><div className="text-xs text-muted-foreground">{r.slug}</div></div> },
          { key: "parent", header: "Parent", render: (r) => r.parent?.name || "—" },
          { key: "products", header: "Products", render: (r) => r._count?.products ?? 0 },
          { key: "children", header: "Subcategories", render: (r) => r._count?.children ?? 0 },
          { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
          { key: "actions", header: "", render: (r) => <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); del(r.id); }}><Trash2 className="h-3.5 w-3.5" /></Button> },
        ]}
      />
    </div>
  );
}

export function CategoryForm({ categories, onCreate }: { categories: Category[]; onCreate: (data: any) => void }) {
  const [f, setF] = useState({ name: "", slug: "", description: "", parentId: "", status: "ACTIVE", sortOrder: 0 });
  return (
    <div>
      <DialogHeader><DialogTitle>New Category</DialogTitle></DialogHeader>
      <div className="space-y-3 py-2">
        <div><Label>Name</Label><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
        <div><Label>Slug (optional)</Label><Input value={f.slug} onChange={(e) => setF({ ...f, slug: e.target.value })} /></div>
        <div><Label>Parent (optional)</Label>
          <Select value={f.parentId} onValueChange={(v) => setF({ ...f, parentId: v })}>
            <SelectTrigger><SelectValue placeholder="None (top-level)" /></SelectTrigger>
            <SelectContent><SelectItem value="">None (top-level)</SelectItem>{categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label>Description</Label><Textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
        <Button onClick={() => onCreate({ ...f, slug: f.slug || undefined })} disabled={!f.name}>Create</Button>
      </div>
    </div>
  );
}
