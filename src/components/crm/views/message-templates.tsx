"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Check, MessageSquare } from "lucide-react";
import { PageHeader, DataTable, StatusBadge } from "../ui";
import { toast } from "sonner";
import { formatDate } from "@/lib/date-range";

type Template = { id: string; name: string; channel: string; category: string; language: string; subject?: string | null; body: string; variables: string[]; isApproved: boolean; externalId?: string | null; status: string; createdAt: string };

export function MessageTemplatesView() {
  const [rows, setRows] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await api.get<{ items: Template[] }>("/api/v1/message-templates");
      setRows(res.items);
    } catch (e) { toast.error((e as Error).message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function del(id: string) {
    if (!confirm("Delete this template?")) return;
    try { await api.del(`/api/v1/message-templates/${id}`); toast.success("Deleted"); load(); }
    catch (e) { toast.error((e as Error).message); }
  }

  async function toggleApproval(t: Template) {
    try { await api.put(`/api/v1/message-templates/${t.id}`, { isApproved: !t.isApproved }); load(); }
    catch (e) { toast.error((e as Error).message); }
  }

  async function create(data: any) {
    try { await api.post("/api/v1/message-templates", data); toast.success("Template created"); setOpen(false); load(); }
    catch (e) { toast.error((e as Error).message); }
  }

  return (
    <div>
      <PageHeader title="Message Templates" description="WhatsApp / Messenger / Email templates with {{variable}} interpolation." action={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" /> New</Button></DialogTrigger>
          <DialogContent className="max-w-2xl"><TemplateForm onCreate={create} /></DialogContent>
        </Dialog>
      } />
      <DataTable<Template>
        rows={rows} loading={loading} page={1} totalPages={1} total={rows.length} limit={rows.length}
        columns={[
          { key: "name", header: "Name", render: (r) => <div><div className="font-medium flex items-center gap-2"><MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />{r.name}</div><div className="text-xs text-muted-foreground">{r.channel} · {r.language}</div></div> },
          { key: "category", header: "Category", render: (r) => <span className="text-xs">{r.category}</span> },
          { key: "body", header: "Body", render: (r) => <div className="text-xs text-muted-foreground max-w-md truncate">{r.body}</div> },
          { key: "vars", header: "Variables", render: (r) => <div className="flex flex-wrap gap-1">{r.variables.map((v) => <span key={v} className="text-[10px] px-1 py-0.5 rounded bg-primary/10 text-primary">{`{{${v}}}`}</span>)}</div> },
          { key: "approved", header: "Approved", render: (r) => <button onClick={(e) => { e.stopPropagation(); toggleApproval(r); }}>{r.isApproved ? <span className="inline-flex items-center text-emerald-600 text-xs"><Check className="h-3.5 w-3.5 mr-1" />Approved</span> : <span className="text-xs text-amber-600">Pending</span>}</button> },
          { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
          { key: "actions", header: "", render: (r) => <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); del(r.id); }}><Trash2 className="h-3.5 w-3.5" /></Button> },
        ]}
      />
    </div>
  );
}

function TemplateForm({ onCreate }: { onCreate: (d: any) => void }) {
  const [f, setF] = useState({ name: "", channel: "whatsapp", category: "TRANSACTIONAL", language: "en", subject: "", body: "", isApproved: false });
  return (
    <div>
      <DialogHeader><DialogTitle>New Message Template</DialogTitle></DialogHeader>
      <div className="space-y-3 py-2 max-h-[70vh] overflow-y-auto pr-1">
        <div><Label>Name (unique)</Label><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="order_received" /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Channel</Label>
            <Select value={f.channel} onValueChange={(v) => setF({ ...f, channel: v })}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="whatsapp">WhatsApp</SelectItem><SelectItem value="messenger">Messenger</SelectItem><SelectItem value="email">Email</SelectItem></SelectContent>
            </Select>
          </div>
          <div><Label>Category</Label>
            <Select value={f.category} onValueChange={(v) => setF({ ...f, category: v })}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="TRANSACTIONAL">Transactional</SelectItem><SelectItem value="MARKETING">Marketing</SelectItem><SelectItem value="UTILITY">Utility</SelectItem></SelectContent>
            </Select>
          </div>
        </div>
        <div><Label>Body — supports {"{{customer_name}}, {{order_number}}, {{order_total}}, {{payment_status}}, {{tracking_number}}, {{business_name}}"}</Label>
          <Textarea value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} className="min-h-[100px]" placeholder="Hi {{customer_name}}, your order {{order_number}}..." />
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.isApproved} onChange={(e) => setF({ ...f, isApproved: e.target.checked })} /> Approved (WhatsApp templates must be approved)</label>
        <Button onClick={() => onCreate({ ...f, subject: f.subject || undefined })} disabled={!f.name || !f.body}>Create Template</Button>
      </div>
    </div>
  );
}

void formatDate;
