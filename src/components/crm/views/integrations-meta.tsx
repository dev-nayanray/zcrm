"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Plus, ShieldCheck, Trash2, RefreshCw, MessageSquare } from "lucide-react";
import { PageHeader, StatusBadge, DataTable } from "../ui";
import { toast } from "sonner";
import { formatDate } from "@/lib/date-range";

type Conn = { id: string; name: string; facebookPageId?: string | null; facebookPageName?: string | null; instagramBusinessId?: string | null; instagramUsername?: string | null; appId?: string | null; connectedUserId?: string | null; status: string; lastSyncAt?: string | null; leadCount: number; hasToken: boolean; accessTokenMasked: string };

export function MetaIntegrationView() {
  const [rows, setRows] = useState<Conn[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  async function load() {
    setLoading(true);
    try { const res = await api.get<{ items: Conn[] }>("/api/v1/integrations/meta/connections"); setRows(res.items); }
    catch (e) { toast.error((e as Error).message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function del(id: string) {
    if (!confirm("Delete this Meta connection?")) return;
    try { await api.del(`/api/v1/integrations/meta/connections/${id}`); toast.success("Deleted"); load(); }
    catch (e) { toast.error((e as Error).message); }
  }

  async function create(data: any) {
    try { await api.post("/api/v1/integrations/meta/connections", data); toast.success("Connection added"); setOpen(false); load(); }
    catch (e) { toast.error((e as Error).message); }
  }

  return (
    <div>
      <PageHeader title="Meta / Facebook / Instagram" description="Multiple Meta connections. Access tokens are NEVER returned to the client." action={
        <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" /> Add Connection</Button>
      } />
      <Card className="mb-4">
        <CardContent className="p-3">
          <Alert><ShieldCheck className="h-4 w-4" /><AlertDescription>
            Webhook verification (GET hub.challenge) and signature validation. Idempotent event processing via WebhookEvent (provider="meta"). Tokens stored server-side only.
          </AlertDescription></Alert>
          <div className="mt-3 text-sm">
            <p className="text-xs text-muted-foreground mb-1">Meta webhook URL (register in Facebook App → Webhooks):</p>
            <code className="block p-2 rounded bg-muted text-xs break-all">{typeof window !== "undefined" ? `${window.location.origin}/api/v1/integrations/meta/webhook` : "/api/v1/integrations/meta/webhook"}</code>
          </div>
        </CardContent>
      </Card>

      <DataTable<Conn>
        rows={rows} loading={loading} page={1} totalPages={1} total={rows.length} limit={rows.length}
        columns={[
          { key: "name", header: "Connection", render: (r) => <div><div className="font-medium">{r.name}</div><div className="text-xs text-muted-foreground">{r.facebookPageName ?? r.instagramUsername ?? "—"}</div></div> },
          { key: "page", header: "Facebook Page", render: (r) => r.facebookPageId ?? "—" },
          { key: "ig", header: "Instagram", render: (r) => r.instagramUsername ?? "—" },
          { key: "leads", header: "Leads", render: (r) => r.leadCount },
          { key: "token", header: "Token", render: (r) => <span className="text-xs font-mono">{r.hasToken ? r.accessTokenMasked : "none"}</span> },
          { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
          { key: "sync", header: "Last Sync", render: (r) => r.lastSyncAt ? <span className="text-xs">{formatDate(r.lastSyncAt)}</span> : "—" },
          { key: "actions", header: "", render: (r) => <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); del(r.id); }}><Trash2 className="h-3.5 w-3.5" /></Button> },
        ]}
      />

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setOpen(false)}>
          <Card className="w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><MessageSquare className="h-4 w-4" /> New Meta Connection</CardTitle></CardHeader>
            <CardContent><MetaForm onCreate={create} /></CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function MetaForm({ onCreate }: { onCreate: (d: any) => void }) {
  const [f, setF] = useState({ name: "", facebookPageId: "", facebookPageName: "", instagramBusinessId: "", instagramUsername: "", accessToken: "", appId: "", webhookVerifyToken: "" });
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Connection Name</Label><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Main Facebook Page" /></div>
        <div><Label>App ID</Label><Input value={f.appId} onChange={(e) => setF({ ...f, appId: e.target.value })} /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Facebook Page ID</Label><Input value={f.facebookPageId} onChange={(e) => setF({ ...f, facebookPageId: e.target.value })} /></div>
        <div><Label>Facebook Page Name</Label><Input value={f.facebookPageName} onChange={(e) => setF({ ...f, facebookPageName: e.target.value })} /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Instagram Business ID</Label><Input value={f.instagramBusinessId} onChange={(e) => setF({ ...f, instagramBusinessId: e.target.value })} /></div>
        <div><Label>Instagram Username</Label><Input value={f.instagramUsername} onChange={(e) => setF({ ...f, instagramUsername: e.target.value })} /></div>
      </div>
      <div><Label>Access Token (server-only)</Label><Input type="password" value={f.accessToken} onChange={(e) => setF({ ...f, accessToken: e.target.value })} placeholder="EAAB..." /></div>
      <div><Label>Webhook Verify Token</Label><Input value={f.webhookVerifyToken} onChange={(e) => setF({ ...f, webhookVerifyToken: e.target.value })} placeholder="your_verify_token" /></div>
      <Button onClick={() => onCreate({ ...f, facebookPageId: f.facebookPageId || undefined, facebookPageName: f.facebookPageName || undefined, instagramBusinessId: f.instagramBusinessId || undefined, instagramUsername: f.instagramUsername || undefined, appId: f.appId || undefined, webhookVerifyToken: f.webhookVerifyToken || undefined })} disabled={!f.name || !f.accessToken}>Save Connection</Button>
    </div>
  );
}

void RefreshCw;
