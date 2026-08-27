"use client";
import { useEffect, useState } from "react";
import { api, money } from "@/lib/api-client";
import { useCrmStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Download, Pencil, Trash2 } from "lucide-react";
import { PageHeader, DataTable } from "../ui";
import { DeleteConfirm, EditDialog } from "../kanban";
import { toast } from "sonner";
import { formatDate } from "@/lib/date-range";

type Customer = { id: string; name: string; phone: string; email?: string | null; city?: string | null; orderCount: number; totalSpending: string; outstanding: string; createdAt: string };

export function CustomersView() {
  const { navigate } = useCrmStore();
  const [rows, setRows] = useState<Customer[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(15);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editC, setEditC] = useState<Customer | null>(null);
  const [editForm, setEditForm] = useState({ name: "", phone: "", email: "", address: "", city: "", notes: "" });
  const [deleteId, setDeleteId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await api.get<{ items: Customer[]; total: number }>(`/api/v1/customers?search=${encodeURIComponent(search)}&page=${page}&limit=${limit}`);
      setRows(res.items); setTotal(res.total);
    } catch (e) { toast.error((e as Error).message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [page]);
  useEffect(() => { setPage(1); load(); }, [search]);

  async function create(data: any) {
    try { await api.post("/api/v1/customers", data); toast.success("Customer created"); setOpen(false); load(); }
    catch (e) { toast.error((e as Error).message); }
  }

  function openEdit(c: Customer) {
    setEditC(c);
    setEditForm({ name: c.name, phone: c.phone, email: c.email ?? "", address: "", city: c.city ?? "", notes: "" });
  }

  async function saveEdit() {
    if (!editC) return;
    try {
      await api.put(`/api/v1/customers/${editC.id}`, { ...editForm, email: editForm.email || undefined });
      toast.success("Customer updated");
      setEditC(null); load();
    } catch (e) { toast.error((e as Error).message); }
  }

  async function confirmDelete() {
    if (!deleteId) return;
    try { await api.del(`/api/v1/customers/${deleteId}`); toast.success("Customer deleted"); setDeleteId(null); load(); }
    catch (e) { toast.error((e as Error).message); }
  }

  return (
    <div>
      <PageHeader title="Customers" description="Centralized customer CRM." action={
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => window.open("/api/v1/exports/customers?type=customers", "_blank")}><Download className="h-4 w-4 mr-1" /> Export</Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" /> New</Button></DialogTrigger>
            <DialogContent><CustomerForm onCreate={create} /></DialogContent>
          </Dialog>
        </div>
      } />
      <DataTable<Customer>
        rows={rows} loading={loading} page={page} totalPages={Math.ceil(total / limit) || 1} total={total} limit={limit}
        onPage={setPage} search={search} onSearch={setSearch} onRowClick={(r) => navigate("customers/detail", { id: r.id })}
        columns={[
          { key: "name", header: "Name", render: (r) => <div className="font-medium">{r.name}</div> },
          { key: "phone", header: "Phone", render: (r) => r.phone },
          { key: "email", header: "Email", render: (r) => r.email || "—" },
          { key: "city", header: "City", render: (r) => r.city || "—" },
          { key: "orders", header: "Orders", render: (r) => r.orderCount },
          { key: "spending", header: "Spending", render: (r) => money(r.totalSpending) },
          { key: "outstanding", header: "Outstanding", render: (r) => <span className={Number(r.outstanding) > 0 ? "text-amber-600 font-medium" : ""}>{money(r.outstanding)}</span> },
          { key: "created", header: "Joined", render: (r) => <span className="text-xs text-muted-foreground">{formatDate(r.createdAt)}</span> },
          { key: "actions", header: "", render: (r) => (
            <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(r)}><Pencil className="h-3.5 w-3.5" /></Button>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => setDeleteId(r.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
            </div>
          ) },
        ]}
      />

      <DeleteConfirm open={!!deleteId} onConfirm={confirmDelete} onCancel={() => setDeleteId(null)} title="Delete Customer" message="Customers with existing orders cannot be deleted." />

      <EditDialog open={!!editC} onClose={() => setEditC(null)} title={`Edit ${editC?.name ?? ""}`}>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Name</Label><Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} /></div>
            <div><Label>Phone</Label><Input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} /></div>
          </div>
          <div><Label>Email</Label><Input value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} /></div>
          <div><Label>City</Label><Input value={editForm.city} onChange={(e) => setEditForm({ ...editForm, city: e.target.value })} /></div>
          <div><Label>Notes</Label><Textarea value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} /></div>
          <Button onClick={saveEdit} className="w-full">Save Changes</Button>
        </div>
      </EditDialog>
    </div>
  );
}

export function CustomerForm({ onCreate, initial }: { onCreate: (data: any) => void; initial?: Partial<Customer> }) {
  const [f, setF] = useState({ name: initial?.name ?? "", phone: initial?.phone ?? "", email: "", address: "", city: initial?.city ?? "", notes: "" });
  return (
    <div>
      <DialogHeader><DialogTitle>New Customer</DialogTitle></DialogHeader>
      <div className="space-y-3 py-2">
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Name</Label><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
          <div><Label>Phone</Label><Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></div>
        </div>
        <div><Label>Email</Label><Input value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
        <div><Label>Address</Label><Input value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} /></div>
        <div><Label>City</Label><Input value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} /></div>
        <div><Label>Notes</Label><Textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></div>
        <Button onClick={() => onCreate({ ...f, email: f.email || undefined })} disabled={!f.name || !f.phone}>Create Customer</Button>
      </div>
    </div>
  );
}
