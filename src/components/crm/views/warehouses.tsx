"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Boxes, Trash2 } from "lucide-react";
import { PageHeader, DataTable } from "../ui";
import { toast } from "sonner";
import { formatDate } from "@/lib/date-range";

type Warehouse = { id: string; name: string; code: string; address?: string | null; isDefault: boolean; isActive: boolean; createdAt: string; _count?: { warehouseStock: number } };

export function WarehousesView() {
  const [rows, setRows] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await api.get<{ items: Warehouse[] }>("/api/v1/warehouses");
      setRows(res.items);
    } catch (e) { toast.error((e as Error).message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function del(id: string) {
    if (!confirm("Delete this warehouse?")) return;
    try { await api.del(`/api/v1/warehouses/${id}`); toast.success("Deleted"); load(); }
    catch (e) { toast.error((e as Error).message); }
  }

  async function create(data: { name: string; code: string; address?: string }) {
    try { await api.post("/api/v1/warehouses", data); toast.success("Warehouse created"); setOpen(false); load(); }
    catch (e) { toast.error((e as Error).message); }
  }

  return (
    <div>
      <PageHeader title="Warehouses" description="Multi-warehouse architecture. Add warehouses now; per-warehouse stock can be enabled later without rebuilding inventory." action={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" /> New</Button></DialogTrigger>
          <DialogContent><WarehouseForm onCreate={create} /></DialogContent>
        </Dialog>
      } />
      <DataTable<Warehouse>
        rows={rows} loading={loading} page={1} totalPages={1} total={rows.length} limit={rows.length}
        columns={[
          { key: "name", header: "Warehouse", render: (r) => <div><div className="font-medium flex items-center gap-2"><Boxes className="h-4 w-4 text-muted-foreground" />{r.name}{r.isDefault && <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">DEFAULT</span>}</div><div className="text-xs text-muted-foreground">{r.code}</div></div> },
          { key: "address", header: "Address", render: (r) => r.address || "—" },
          { key: "stock", header: "Stock Items", render: (r) => r._count?.warehouseStock ?? 0 },
          { key: "active", header: "Status", render: (r) => r.isActive ? <span className="text-emerald-600 text-sm">Active</span> : <span className="text-muted-foreground text-sm">Inactive</span> },
          { key: "created", header: "Created", render: (r) => <span className="text-xs text-muted-foreground">{formatDate(r.createdAt)}</span> },
          { key: "actions", header: "", render: (r) => !r.isDefault && <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); del(r.id); }}><Trash2 className="h-3.5 w-3.5" /></Button> },
        ]}
      />
    </div>
  );
}

function WarehouseForm({ onCreate }: { onCreate: (d: { name: string; code: string; address?: string }) => void }) {
  const [f, setF] = useState({ name: "", code: "", address: "" });
  return (
    <div>
      <DialogHeader><DialogTitle>New Warehouse</DialogTitle></DialogHeader>
      <div className="space-y-3 py-2">
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Name</Label><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
          <div><Label>Code</Label><Input value={f.code} onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase() })} placeholder="MAIN" /></div>
        </div>
        <div><Label>Address</Label><Input value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} /></div>
        <Button onClick={() => onCreate({ ...f, address: f.address || undefined })} disabled={!f.name || !f.code}>Create</Button>
      </div>
    </div>
  );
}
