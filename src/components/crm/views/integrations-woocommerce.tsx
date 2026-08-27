"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { useCrmStore } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Save, RefreshCw, ShieldCheck, Webhook, ShoppingCart, Download, Check } from "lucide-react";
import { PageHeader, StatusBadge } from "../ui";
import { toast } from "sonner";
import { formatDate } from "@/lib/date-range";

type Config = {
  connected: boolean;
  status: string;
  lastSyncAt?: string | null;
  url: string;
  consumerKey: string; // masked
  webhookSecret: string; // masked or empty
};

export function WooCommerceIntegrationView() {
  const {} = useCrmStore();
  const [config, setConfig] = useState<Config | null>(null);
  const [loading, setLoading] = useState(true);
  // Form fields — leave secret fields empty; the service merges with stored values
  const [url, setUrl] = useState("");
  const [consumerKey, setConsumerKey] = useState("");
  const [consumerSecret, setConsumerSecret] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [syncing, setSyncing] = useState("");

  async function load() {
    setLoading(true);
    try {
      const r = await api.get<Config>("/api/v1/integrations/woocommerce");
      setConfig(r);
      setUrl(r.url ?? "");
      // consumerKey is masked (ck_xx****xx); show it so the user knows it's set,
      // but leave it empty in the input so they can type a new one if needed.
      setConsumerKey("");
      setConsumerSecret("");
      setWebhookSecret("");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  async function save() {
    setSaving(true);
    try {
      // Only send fields the user actually typed. Empty fields keep their
      // stored value (the service merges with existing config).
      const payload: Record<string, string> = {};
      if (url) payload.url = url;
      if (consumerKey) payload.consumerKey = consumerKey;
      if (consumerSecret) payload.consumerSecret = consumerSecret;
      if (webhookSecret) payload.webhookSecret = webhookSecret;
      if (Object.keys(payload).length === 0) {
        toast.error("Provide at least one field to update");
        return;
      }
      await api.put("/api/v1/integrations/woocommerce", payload);
      toast.success("Configuration saved");
      load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function test() {
    setTesting(true);
    try {
      const r = await api.post<{ ok: boolean; message: string }>("/api/v1/integrations/woocommerce", { action: "test" });
      if (r.ok) toast.success(r.message);
      else toast.error(r.message);
      load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setTesting(false);
    }
  }

  async function sync(entity: string) {
    setSyncing(entity);
    try {
      const r = await api.post<{ synced: number }>(`/api/v1/integrations/woocommerce/sync?entity=${entity}`, {});
      toast.success(`Synced ${r.synced} ${entity}`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSyncing("");
    }
  }

  if (loading) return <div className="p-8 text-center text-muted-foreground">Loading…</div>;

  return (
    <div>
      <PageHeader title="WooCommerce" description="Website orders & product sync. Consumer secret stored server-side — never returned to the client." action={
        config && <StatusBadge status={config.status} />
      } />

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><ShoppingCart className="h-4 w-4" /> Connection Settings</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Alert>
                <ShieldCheck className="h-4 w-4" />
                <AlertDescription>
                  The consumer secret is stored server-side and never returned to the browser. Leave any field blank to keep its current value — only fields you type will be updated.
                </AlertDescription>
              </Alert>
              <div>
                <Label>WordPress / WooCommerce URL</Label>
                <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://yourstore.com" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label>Consumer Key</Label>
                  <Input value={consumerKey} onChange={(e) => setConsumerKey(e.target.value)} placeholder={config?.consumerKey ? `${config.consumerKey} (stored)` : "ck_..."} />
                </div>
                <div>
                  <Label>Consumer Secret</Label>
                  <Input type="password" value={consumerSecret} onChange={(e) => setConsumerSecret(e.target.value)} placeholder={config?.consumerKey ? "•••• stored (type to replace)" : "cs_..."} />
                </div>
              </div>
              <div>
                <Label>Webhook Secret (optional)</Label>
                <Input type="password" value={webhookSecret} onChange={(e) => setWebhookSecret(e.target.value)} placeholder={config?.webhookSecret ? "•••• stored (type to replace)" : "Secret for HMAC verification"} />
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                <Button onClick={save} disabled={saving}><Save className="h-4 w-4 mr-1" /> {saving ? "Saving…" : "Save Configuration"}</Button>
                <Button variant="outline" onClick={test} disabled={testing}><RefreshCw className={`h-4 w-4 mr-1 ${testing ? "animate-spin" : ""}`} /> {testing ? "Testing…" : "Test Connection"}</Button>
                <Button variant="outline" onClick={() => sync("products")} disabled={!!syncing}>{syncing === "products" ? <RefreshCw className="h-4 w-4 mr-1 animate-spin" /> : <Download className="h-4 w-4 mr-1" />} Sync Products</Button>
                <Button variant="outline" onClick={() => sync("orders")} disabled={!!syncing}>{syncing === "orders" ? <RefreshCw className="h-4 w-4 mr-1 animate-spin" /> : <Download className="h-4 w-4 mr-1" />} Sync Orders</Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Webhook className="h-4 w-4" /> Webhook</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="text-muted-foreground">Register this URL in WooCommerce → Settings → API → Webhooks:</p>
              <code className="block p-2 rounded bg-muted text-xs break-all">{typeof window !== "undefined" ? `${window.location.origin}/api/v1/integrations/woocommerce/webhook` : "/api/v1/integrations/woocommerce/webhook"}</code>
              <p className="text-xs text-muted-foreground mt-2">Topics: <code>order.created</code>, <code>order.updated</code>, <code>product.created</code>, <code>product.updated</code>, <code>customer.created</code>, <code>customer.updated</code>. Delivery is HMAC-signed and idempotent.</p>
              {config?.lastSyncAt && (
                <div className="mt-3 pt-2 border-t flex items-center gap-2 text-xs text-muted-foreground">
                  <Check className="h-3.5 w-3.5 text-emerald-600" /> Last sync: {formatDate(config.lastSyncAt)}
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Status</CardTitle></CardHeader>
            <CardContent className="space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Connected</span><span className="font-medium">{config?.connected ? "Yes" : "No"}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Status</span><StatusBadge status={config?.status ?? "DISCONNECTED"} /></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Consumer Key</span><span className="text-xs font-mono">{config?.consumerKey || "not set"}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Webhook Secret</span><span className="text-xs">{config?.webhookSecret ? "set" : "not set"}</span></div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
