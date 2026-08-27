"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { PageHeader, StatusBadge } from "../ui";
import { toast } from "sonner";
import { Bell, Save } from "lucide-react";

export function SettingsView() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const r = await api.get<{ settings: Record<string, string> }>("/api/v1/settings");
      setSettings(r.settings);
    } catch (e) { toast.error((e as Error).message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function save() {
    setSaving(true);
    try {
      await api.put("/api/v1/settings", { settings });
      toast.success("Settings saved");
    } catch (e) { toast.error((e as Error).message); }
    finally { setSaving(false); }
  }

  if (loading) return <div className="p-8 text-center text-muted-foreground">Loading…</div>;

  return (
    <div>
      <PageHeader title="Settings" description="Global business configuration." action={
        <Button onClick={save} disabled={saving}><Save className="h-4 w-4 mr-1" /> {saving ? "Saving…" : "Save"}</Button>
      } />
      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Business</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div><Label>Business Name</Label><Input value={settings.businessName ?? ""} onChange={(e) => setSettings({ ...settings, businessName: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Currency</Label><Input value={settings.currency ?? "BDT"} onChange={(e) => setSettings({ ...settings, currency: e.target.value })} /></div>
              <div><Label>Currency Symbol</Label><Input value={settings.currencySymbol ?? "৳"} onChange={(e) => setSettings({ ...settings, currencySymbol: e.target.value })} /></div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Inventory</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <Label>Allow Negative Stock</Label>
                <p className="text-xs text-muted-foreground">Permit selling more than available quantity (not recommended).</p>
              </div>
              <Switch checked={settings.allowNegativeStock === "true"} onCheckedChange={(c) => setSettings({ ...settings, allowNegativeStock: c ? "true" : "false" })} />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
