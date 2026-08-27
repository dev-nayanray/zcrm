"use client";
import { useEffect, useState } from "react";
import { api, money, num } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Download, Trash2, Pencil } from "lucide-react";
import { PageHeader, DataTable } from "../ui";
import { EditDialog } from "../kanban";
import { toast } from "sonner";
import { formatDate } from "@/lib/date-range";

type Expense = { id: string; amount: string; paymentMethod: string; description?: string | null; reference?: string | null; expenseDate: string; category: { id: string; name: string }; createdAt: string };

export function ExpensesView() {
  const [rows, setRows] = useState<Expense[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(15);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editExpense, setEditExpense] = useState<Expense | null>(null);
  const [editForm, setEditForm] = useState({ amount: "", categoryId: "", paymentMethod: "CASH", description: "", reference: "", expenseDate: "" });
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => { api.get<{ items: { id: string; name: string }[] }>("/api/v1/expense-categories").then((r) => setCategories(r.items)).catch(() => {}); }, []);

  async function load() {
    setLoading(true);
    try {
      const res = await api.get<{ items: Expense[]; total: number }>(`/api/v1/expenses?search=${encodeURIComponent(search)}&page=${page}&limit=${limit}`);
      setRows(res.items); setTotal(res.total);
    } catch (e) { toast.error((e as Error).message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [page]);
  useEffect(() => { setPage(1); load(); }, [search]);

  async function create(data: any) {
    try { await api.post("/api/v1/expenses", data); toast.success("Expense created"); setOpen(false); load(); }
    catch (e) { toast.error((e as Error).message); }
  }

  async function del(id: string) {
    if (!confirm("Delete this expense?")) return;
    try { await api.del(`/api/v1/expenses/${id}`); toast.success("Deleted"); load(); }
    catch (e) { toast.error((e as Error).message); }
  }

  return (
    <div>
      <PageHeader title="Expenses" description="Operating expenses feed directly into Profit & Loss." action={
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => window.open("/api/v1/exports/expenses?type=expenses", "_blank")}><Download className="h-4 w-4 mr-1" /> Export</Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" /> New</Button></DialogTrigger>
            <DialogContent><ExpenseForm categories={categories} onCreate={create} /></DialogContent>
          </Dialog>
        </div>
      } />
      <DataTable<Expense>
        rows={rows} loading={loading} page={page} totalPages={Math.ceil(total / limit) || 1} total={total} limit={limit}
        onPage={setPage} search={search} onSearch={setSearch}
        columns={[
          { key: "date", header: "Date", render: (r) => <span className="text-xs">{formatDate(r.expenseDate)}</span> },
          { key: "category", header: "Category", render: (r) => <span className="font-medium">{r.category.name}</span> },
          { key: "description", header: "Description", render: (r) => r.description || "—" },
          { key: "amount", header: "Amount", render: (r) => <span className="font-medium">{money(r.amount)}</span> },
          { key: "method", header: "Method", render: (r) => r.paymentMethod },
          { key: "ref", header: "Reference", render: (r) => r.reference || "—" },
          { key: "actions", header: "", render: (r) => (
            <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditExpense(r); setEditForm({ amount: r.amount, categoryId: r.category.id, paymentMethod: r.paymentMethod, description: r.description ?? "", reference: r.reference ?? "", expenseDate: r.expenseDate?.slice(0, 10) ?? "" }); }}><Pencil className="h-3.5 w-3.5" /></Button>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => del(r.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
            </div>
          ) },
        ]}
      />

      <EditDialog open={!!editExpense} onClose={() => setEditExpense(null)} title="Edit Expense">
        <div className="space-y-3">
          <div><Label>Amount</Label><Input type="number" value={editForm.amount} onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })} /></div>
          <div><Label>Category</Label>
            <select className="w-full rounded-lg border border-border px-3 h-9 text-sm" value={editForm.categoryId} onChange={(e) => setEditForm({ ...editForm, categoryId: e.target.value })}>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div><Label>Payment Method</Label>
            <select className="w-full rounded-lg border border-border px-3 h-9 text-sm" value={editForm.paymentMethod} onChange={(e) => setEditForm({ ...editForm, paymentMethod: e.target.value })}>
              <option value="CASH">Cash</option><option value="BKASH">bKash</option><option value="NAGAD">Nagad</option><option value="BANK">Bank</option><option value="CARD">Card</option>
            </select>
          </div>
          <div><Label>Description</Label><Textarea value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} /></div>
          <Button className="w-full" onClick={async () => { if (editExpense) { try { await api.put(`/api/v1/expenses/${editExpense.id}`, editForm); toast.success("Expense updated"); setEditExpense(null); load(); } catch (e) { toast.error((e as Error).message); } } }}>Save Changes</Button>
        </div>
      </EditDialog>
    </div>
  );
}

function ExpenseForm({ categories, onCreate }: { categories: { id: string; name: string }[]; onCreate: (data: any) => void }) {
  const [f, setF] = useState({ categoryId: "", amount: 0, paymentMethod: "CASH", description: "", reference: "", expenseDate: "" });
  return (
    <div>
      <DialogHeader><DialogTitle>New Expense</DialogTitle></DialogHeader>
      <div className="space-y-3 py-2">
        <div><Label>Category</Label>
          <Select value={f.categoryId} onValueChange={(v) => setF({ ...f, categoryId: v })}><SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
            <SelectContent>{categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Amount</Label><Input type="number" value={f.amount} onChange={(e) => setF({ ...f, amount: num(e.target.value) })} /></div>
          <div><Label>Method</Label>
            <Select value={f.paymentMethod} onValueChange={(v) => setF({ ...f, paymentMethod: v })}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="CASH">Cash</SelectItem><SelectItem value="BKASH">bKash</SelectItem><SelectItem value="NAGAD">Nagad</SelectItem><SelectItem value="BANK">Bank</SelectItem><SelectItem value="CARD">Card</SelectItem><SelectItem value="OTHER">Other</SelectItem></SelectContent>
            </Select>
          </div>
        </div>
        <div><Label>Description</Label><Textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Reference</Label><Input value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} /></div>
          <div><Label>Date</Label><Input type="date" value={f.expenseDate} onChange={(e) => setF({ ...f, expenseDate: e.target.value })} /></div>
        </div>
        <Button onClick={() => onCreate({ ...f, amount: String(f.amount) })} disabled={!f.categoryId || f.amount <= 0}>Create</Button>
      </div>
    </div>
  );
}
