"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, Truck } from "lucide-react";
import { PageHeader, StatusBadge, DataTable } from "../ui";
import { toast } from "sonner";
import { formatDate } from "@/lib/date-range";

type Provider = { id: string; name: string; code: string; apiUrl?: string | null; isActive: boolean; isMock: boolean; hasKey: boolean; _count?: { deliveries: number }; createdAt: string };

export function CouriersView() {
  const [rows, setRows] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: "", code: "", apiUrl: "", apiKey: "", isMock: true });

  async function load() {
    setLoading(true);
    try { const res = await api.get<{ items: Provider[] }>("/api/v1/couriers"); setRows(res.items); }
    catch (e) { toast.error((e as Error).message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function create() {
    try { await api.post("/api/v1/couriers", { ...f, code: f.code.toUpperCase(), apiUrl: f.apiUrl || undefined, apiKey: f.apiKey || undefined }); toast.success("Provider added"); setOpen(false); load(); }
    catch (e) { toast.error((e as Error).message); }
  }
  async function toggle(p: Provider) {
    try { await api.put(`/api/v1/couriers/${p.id}`, { isActive: !p.isActive }); load(); }
    catch (e) { toast.error((e as Error).message); }
  }
  async function del(id: string) {
    if (!confirm("Delete this courier provider?")) return;
    try { await api.del(`/api/v1/couriers/${id}`); toast.success("Deleted"); load(); }
    catch (e) { toast.error((e as Error).message); }
  }

  return (
    <div>
      <PageHeader title="Courier Providers" description="Bangladesh courier abstraction (Pathao, Steadfast, RedX, Other). Mock providers simulate the API so the system is fully testable without real credentials." action={
        <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" /> Add Provider</Button>
      } />
      <DataTable<Provider>
        rows={rows} loading={loading} page={1} totalPages={1} total={rows.length} limit={rows.length}
        columns={[
          { key: "name", header: "Provider", render: (r) => <div><div className="font-medium flex items-center gap-2"><Truck className="h-3.5 w-3.5 text-muted-foreground" />{r.name}</div><div className="text-xs text-muted-foreground">{r.code}</div></div> },
          { key: "apiUrl", header: "API URL", render: (r) => r.apiUrl ? <span className="text-xs font-mono">{r.apiUrl}</span> : <span className="text-xs text-muted-foreground">none (mock)</span> },
          { key: "key", header: "Key", render: (r) => <span className="text-xs">{r.hasKey ? "••••" : "none"}</span> },
          { key: "mock", header: "Mode", render: (r) => r.isMock ? <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">MOCK</span> : <span className="text-xs px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">LIVE</span> },
          { key: "deliveries", header: "Deliveries", render: (r) => r._count?.deliveries ?? 0 },
          { key: "active", header: "Status", render: (r) => <button onClick={(e) => { e.stopPropagation(); toggle(r); }}><StatusBadge status={r.isActive ? "ACTIVE" : "INACTIVE"} /></button> },
          { key: "actions", header: "", render: (r) => <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); del(r.id); }}><Trash2 className="h-3.5 w-3.5" /></Button> },
        ]}
      />
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setOpen(false)}>
          <Card className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <CardContent className="p-4 space-y-3">
              <h3 className="font-semibold">New Courier Provider</h3>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Name</Label><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Pathao" /></div>
                <div><Label>Code</Label><Input value={f.code} onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase() })} placeholder="PTHO" /></div>
              </div>
              <div><Label>API URL (leave empty for mock)</Label><Input value={f.apiUrl} onChange={(e) => setF({ ...f, apiUrl: e.target.value })} placeholder="https://api.courier.com" /></div>
              <div><Label>API Key (server-only)</Label><Input type="password" value={f.apiKey} onChange={(e) => setF({ ...f, apiKey: e.target.value })} /></div>
              <label className="flex items-center gap-2 text-sm"><Switch checked={f.isMock} onCheckedChange={(c) => setF({ ...f, isMock: c })} /> Mock mode (no real API calls)</label>
              <Button onClick={create} disabled={!f.name || !f.code}>Add Provider</Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

void formatDate;
