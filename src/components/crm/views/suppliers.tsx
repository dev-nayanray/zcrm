"use client";
import { useEffect, useState } from "react";
import { api, money } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Download, Pencil, Trash2 } from "lucide-react";
import { PageHeader, DataTable } from "../ui";
import { DeleteConfirm, EditDialog } from "../kanban";
import { toast } from "sonner";
import { formatDate } from "@/lib/date-range";

type Supplier = { id: string; name: string; phone?: string | null; company?: string | null; city?: string | null; purchaseCount: number; totalPurchases: string; outstanding: string; createdAt: string };

export function SuppliersView() {
  const [rows, setRows] = useState<Supplier[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(15);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [paySupplier, setPaySupplier] = useState<Supplier | null>(null);
  const [editSupplier, setEditSupplier] = useState<Supplier | null>(null);
  const [editForm, setEditForm] = useState({ name: "", phone: "", company: "", email: "", address: "", notes: "" });
  const [deleteId, setDeleteId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await api.get<{ items: Supplier[]; total: number }>(`/api/v1/suppliers?search=${encodeURIComponent(search)}&page=${page}&limit=${limit}`);
      setRows(res.items); setTotal(res.total);
    } catch (e) { toast.error((e as Error).message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [page]);
  useEffect(() => { setPage(1); load(); }, [search]);

  async function create(data: any) {
    try { await api.post("/api/v1/suppliers", data); toast.success("Supplier created"); setOpen(false); load(); }
    catch (e) { toast.error((e as Error).message); }
  }

  return (
    <div>
      <PageHeader title="Suppliers" description="Vendor & payables management." action={
        <Button variant="outline" size="sm" onClick={() => window.open("/api/v1/exports/suppliers?type=suppliers", "_blank")}><Download className="h-4 w-4 mr-1" /> Export</Button>
      } />
      <DataTable<Supplier>
        rows={rows} loading={loading} page={page} totalPages={Math.ceil(total / limit) || 1} total={total} limit={limit}
        onPage={setPage} search={search} onSearch={setSearch}
        columns={[
          { key: "name", header: "Name", render: (r) => <div><div className="font-medium">{r.name}</div><div className="text-xs text-muted-foreground">{r.company}</div></div> },
          { key: "phone", header: "Phone", render: (r) => r.phone || "—" },
          { key: "purchases", header: "Purchases", render: (r) => r.purchaseCount },
          { key: "total", header: "Total Purchases", render: (r) => money(r.totalPurchases) },
          { key: "outstanding", header: "Payable", render: (r) => <span className={Number(r.outstanding) > 0 ? "text-amber-600 font-medium" : ""}>{money(r.outstanding)}</span> },
          { key: "created", header: "Created", render: (r) => <span className="text-xs text-muted-foreground">{formatDate(r.createdAt)}</span> },
          { key: "actions", header: "", render: (r) => (
            <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setPaySupplier(r)}>Pay</Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditSupplier(r); setEditForm({ name: r.name, phone: r.phone ?? "", company: r.company ?? "", email: "", address: "", notes: "" }); }}><Pencil className="h-3.5 w-3.5" /></Button>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => setDeleteId(r.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
            </div>
          ) },
        ]}
      />
      <div className="mt-4">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" /> New Supplier</Button></DialogTrigger>
          <DialogContent><SupplierForm onCreate={create} /></DialogContent>
        </Dialog>
      </div>
      {paySupplier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setPaySupplier(null)}>
          <Card className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <CardContent className="p-4">
              <SupplierPaymentForm supplier={paySupplier} onDone={() => { setPaySupplier(null); load(); }} />
            </CardContent>
          </Card>
        </div>
      )}

      <DeleteConfirm
        open={!!deleteId}
        onConfirm={async () => { if (deleteId) { try { await api.del(`/api/v1/suppliers/${deleteId}`); toast.success("Supplier deleted"); setDeleteId(null); load(); } catch (e) { toast.error((e as Error).message); } } }}
        onCancel={() => setDeleteId(null)}
        title="Delete Supplier"
        message="Suppliers with existing purchases cannot be deleted."
      />

      <EditDialog open={!!editSupplier} onClose={() => setEditSupplier(null)} title={`Edit ${editSupplier?.name ?? ""}`}>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Name</Label><Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} /></div>
            <div><Label>Phone</Label><Input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} /></div>
          </div>
          <div><Label>Company</Label><Input value={editForm.company} onChange={(e) => setEditForm({ ...editForm, company: e.target.value })} /></div>
          <div><Label>Email</Label><Input value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} /></div>
          <div><Label>Address</Label><Input value={editForm.address} onChange={(e) => setEditForm({ ...editForm, address: e.target.value })} /></div>
          <Button className="w-full" onClick={async () => { if (editSupplier) { try { await api.put(`/api/v1/suppliers/${editSupplier.id}`, { ...editForm, email: editForm.email || undefined }); toast.success("Supplier updated"); setEditSupplier(null); load(); } catch (e) { toast.error((e as Error).message); } } }}>Save Changes</Button>
        </div>
      </EditDialog>
    </div>
  );
}

export function SupplierForm({ onCreate }: { onCreate: (data: any) => void }) {
  const [f, setF] = useState({ name: "", phone: "", email: "", address: "", company: "", notes: "" });
  return (
    <div>
      <DialogHeader><DialogTitle>New Supplier</DialogTitle></DialogHeader>
      <div className="space-y-3 py-2">
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Name</Label><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
          <div><Label>Company</Label><Input value={f.company} onChange={(e) => setF({ ...f, company: e.target.value })} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Phone</Label><Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></div>
          <div><Label>Email</Label><Input value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
        </div>
        <div><Label>Address</Label><Input value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} /></div>
        <div><Label>Notes</Label><Textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></div>
        <Button onClick={() => onCreate({ ...f, email: f.email || undefined })} disabled={!f.name}>Create</Button>
      </div>
    </div>
  );
}

function SupplierPaymentForm({ supplier, onDone }: { supplier: Supplier; onDone: () => void }) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("CASH");
  const [ref, setRef] = useState("");
  const [saving, setSaving] = useState(false);
  async function submit() {
    if (!amount || Number(amount) <= 0) return;
    setSaving(true);
    try {
      await api.post("/api/v1/supplier-payments", { supplierId: supplier.id, amount, method, transactionReference: ref || undefined });
      toast.success("Supplier payment recorded");
      onDone();
    } catch (e) { toast.error((e as Error).message); }
    finally { setSaving(false); }
  }
  return (
    <div>
      <DialogHeader><DialogTitle>Pay {supplier.name}</DialogTitle></DialogHeader>
      <div className="space-y-3 py-2">
        <div className="text-sm bg-muted/50 rounded p-2 flex justify-between"><span className="text-muted-foreground">Outstanding payable</span><span className="font-semibold text-amber-600">{money(supplier.outstanding)}</span></div>
        <div><Label>Amount</Label><Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" /></div>
        <div><Label>Method</Label>
          <select className="w-full rounded-md border border-border bg-background px-3 h-9 text-sm" value={method} onChange={(e) => setMethod(e.target.value)}>
            <option value="CASH">Cash</option><option value="BKASH">bKash</option><option value="NAGAD">Nagad</option><option value="BANK">Bank</option><option value="CARD">Card</option><option value="OTHER">Other</option>
          </select>
        </div>
        <div><Label>Reference</Label><Input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="Txn ID / cheque #" /></div>
        <Button onClick={submit} disabled={saving || !amount}>Record Payment</Button>
      </div>
    </div>
  );
}
