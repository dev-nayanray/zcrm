"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Plus, ShieldCheck, Trash2, Phone } from "lucide-react";
import { PageHeader, StatusBadge, DataTable } from "../ui";
import { toast } from "sonner";
import { formatDate } from "@/lib/date-range";

type Conn = { id: string; name: string; phoneNumberId: string; phoneNumber?: string | null; businessAccountId?: string | null; wabaId?: string | null; status: string; lastSyncAt?: string | null; hasToken: boolean; accessTokenMasked: string };

export function WhatsAppIntegrationView() {
  const [rows, setRows] = useState<Conn[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  async function load() {
    setLoading(true);
    try { const res = await api.get<{ items: Conn[] }>("/api/v1/integrations/whatsapp/connections"); setRows(res.items); }
    catch (e) { toast.error((e as Error).message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function del(id: string) {
    if (!confirm("Delete this WhatsApp connection?")) return;
    try { await api.del(`/api/v1/integrations/whatsapp/connections/${id}`); toast.success("Deleted"); load(); }
    catch (e) { toast.error((e as Error).message); }
  }

  async function create(data: any) {
    try { await api.post("/api/v1/integrations/whatsapp/connections", data); toast.success("Connection added"); setOpen(false); load(); }
    catch (e) { toast.error((e as Error).message); }
  }

  return (
    <div>
      <PageHeader title="WhatsApp Business" description="Cloud API integration. Access tokens are NEVER returned to the client." action={
        <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" /> Add Connection</Button>
      } />
      <Card className="mb-4">
        <CardContent className="p-3">
          <Alert><ShieldCheck className="h-4 w-4" /><AlertDescription>
            Official WhatsApp Business Cloud API. Webhook verification (GET hub.challenge). Idempotent inbound processing via WebhookEvent (provider="whatsapp"). Outbound messages use approved templates for transactional notifications.
          </AlertDescription></Alert>
          <div className="mt-3 text-sm">
            <p className="text-xs text-muted-foreground mb-1">WhatsApp webhook URL (register in Meta App → WhatsApp → Webhook):</p>
            <code className="block p-2 rounded bg-muted text-xs break-all">{typeof window !== "undefined" ? `${window.location.origin}/api/v1/integrations/whatsapp/webhook` : "/api/v1/integrations/whatsapp/webhook"}</code>
          </div>
        </CardContent>
      </Card>

      <DataTable<Conn>
        rows={rows} loading={loading} page={1} totalPages={1} total={rows.length} limit={rows.length}
        columns={[
          { key: "name", header: "Connection", render: (r) => <div><div className="font-medium flex items-center gap-2"><Phone className="h-3.5 w-3.5 text-emerald-500" />{r.name}</div><div className="text-xs text-muted-foreground">{r.phoneNumber ?? "—"}</div></div> },
          { key: "phoneId", header: "Phone Number ID", render: (r) => <span className="text-xs font-mono">{r.phoneNumberId}</span> },
          { key: "waba", header: "WABA ID", render: (r) => r.wabaId ?? "—" },
          { key: "token", header: "Token", render: (r) => <span className="text-xs font-mono">{r.hasToken ? r.accessTokenMasked : "none"}</span> },
          { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
          { key: "sync", header: "Last Sync", render: (r) => r.lastSyncAt ? <span className="text-xs">{formatDate(r.lastSyncAt)}</span> : "—" },
          { key: "actions", header: "", render: (r) => <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); del(r.id); }}><Trash2 className="h-3.5 w-3.5" /></Button> },
        ]}
      />

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setOpen(false)}>
          <Card className="w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Phone className="h-4 w-4" /> New WhatsApp Connection</CardTitle></CardHeader>
            <CardContent><WhatsAppForm onCreate={create} /></CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function WhatsAppForm({ onCreate }: { onCreate: (d: any) => void }) {
  const [f, setF] = useState({ name: "", phoneNumberId: "", phoneNumber: "", businessAccountId: "", wabaId: "", accessToken: "", webhookVerifyToken: "" });
  return (
    <div className="space-y-3">
      <div><Label>Connection Name</Label><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Sales WhatsApp" /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Phone Number ID</Label><Input value={f.phoneNumberId} onChange={(e) => setF({ ...f, phoneNumberId: e.target.value })} /></div>
        <div><Label>Display Phone Number</Label><Input value={f.phoneNumber} onChange={(e) => setF({ ...f, phoneNumber: e.target.value })} placeholder="+88017..." /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Business Account ID</Label><Input value={f.businessAccountId} onChange={(e) => setF({ ...f, businessAccountId: e.target.value })} /></div>
        <div><Label>WABA ID</Label><Input value={f.wabaId} onChange={(e) => setF({ ...f, wabaId: e.target.value })} /></div>
      </div>
      <div><Label>Access Token (server-only)</Label><Input type="password" value={f.accessToken} onChange={(e) => setF({ ...f, accessToken: e.target.value })} placeholder="EAAB..." /></div>
      <div><Label>Webhook Verify Token</Label><Input value={f.webhookVerifyToken} onChange={(e) => setF({ ...f, webhookVerifyToken: e.target.value })} /></div>
      <Button onClick={() => onCreate({ ...f, phoneNumber: f.phoneNumber || undefined, businessAccountId: f.businessAccountId || undefined, wabaId: f.wabaId || undefined, webhookVerifyToken: f.webhookVerifyToken || undefined })} disabled={!f.name || !f.phoneNumberId || !f.accessToken}>Save Connection</Button>
    </div>
  );
}
