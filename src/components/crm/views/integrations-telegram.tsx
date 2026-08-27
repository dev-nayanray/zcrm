"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Save, Send, Trash2, Plus, Users, Bell, Activity, Settings, MessageCircle, CheckCircle2, XCircle, Zap, Link2, Copy, Radio } from "lucide-react";
import { PageHeader, StatusBadge } from "../ui";
import { toast } from "sonner";
import { formatDate } from "@/lib/date-range";
import { ROLES } from "@/lib/constants";

const EVENT_TYPES = ["CRM_UPDATE", "NEW_ORDER", "NEW_LEAD", "NEW_MESSAGE", "LOW_STOCK", "OUT_OF_STOCK", "PAYMENT_RECEIVED", "DUE_PAYMENT", "DELIVERY_UPDATE", "STOCK_COUNT_APPROVAL", "SYSTEM_ALERT", "PURCHASE_DUE"];

const EVENT_LABELS: Record<string, string> = {
  CRM_UPDATE: "🔄 Every CRM Update (all creates/edits/deletes)",
  NEW_ORDER: "🆕 New Order", NEW_LEAD: "🎯 New Lead", NEW_MESSAGE: "💬 New Message",
  LOW_STOCK: "⚠️ Low Stock", OUT_OF_STOCK: "🚨 Out of Stock", PAYMENT_RECEIVED: "💰 Payment Received",
  DUE_PAYMENT: "📋 Due Payment", DELIVERY_UPDATE: "🚚 Delivery Update",
  STOCK_COUNT_APPROVAL: "📋 Stock Count Approval", SYSTEM_ALERT: "🔔 System Alert", PURCHASE_DUE: "🛒 Purchase Due",
};

export function TelegramIntegrationView() {
  const [tab, setTab] = useState<"overview" | "config" | "groups" | "users" | "notifications" | "activity">("overview");
  const [status, setStatus] = useState<any>(null);
  const [stats, setStats] = useState<any>({ groupCount: 0, userCount: 0, commandCount: 0, lastWebhook: null });
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ botToken: "", botUsername: "", webhookUrl: "", webhookSecret: "", defaultLanguage: "en" });
  const [saving, setSaving] = useState(false);
  const [settingWebhook, setSettingWebhook] = useState(false);
  const [checkingWebhook, setCheckingWebhook] = useState(false);
  const [webhookResult, setWebhookResult] = useState<{ ok: boolean; error?: string } | null>(null);

  async function setWebhook() {
    setSettingWebhook(true);
    setWebhookResult(null);
    try {
      const url = form.webhookUrl || `${typeof window !== "undefined" ? window.location.origin : ""}/api/v1/integrations/telegram/webhook`;
      const res = await api.post<any>("/api/v1/integrations/telegram/config", { action: "setWebhook", url });
      setWebhookResult({ ok: true });
      toast.success("Webhook set on Telegram! Your bot will now receive updates.");
      loadStatus();
    } catch (e) {
      setWebhookResult({ ok: false, error: (e as Error).message });
      toast.error((e as Error).message);
    } finally {
      setSettingWebhook(false);
    }
  }

  async function checkWebhook() {
    setCheckingWebhook(true);
    setWebhookResult(null);
    try {
      const res = await api.post<any>("/api/v1/integrations/telegram/config", { action: "getWebhookInfo" });
      const info = res?.result || res;
      if (info?.ok) {
        const wh = info.result;
        if (wh?.url) {
          setWebhookResult({ ok: true });
          toast.success(`Webhook active: ${wh.url}`);
        } else {
          setWebhookResult({ ok: false, error: "No webhook URL set on Telegram. Click 'Set Webhook on Telegram' first." });
        }
      } else {
        setWebhookResult({ ok: false, error: "Could not check webhook status." });
      }
    } catch (e) {
      setWebhookResult({ ok: false, error: (e as Error).message });
    } finally {
      setCheckingWebhook(false);
    }
  }

  async function loadStatus() {
    setLoading(true);
    try {
      const s = await api.get<any>("/api/v1/integrations/telegram/config");
      setStatus(s);
      setForm((f) => ({ ...f, botUsername: s.botUsername ?? "", webhookUrl: s.webhookUrl ?? "", webhookSecret: "", defaultLanguage: s.defaultLanguage ?? "en" }));
      // load stats
      const [groups, users, audit] = await Promise.all([
        api.get<{ items: any[] }>("/api/v1/integrations/telegram/groups"),
        api.get<{ items: any[] }>("/api/v1/integrations/telegram/users"),
        api.get<{ items: any[]; total: number }>("/api/v1/integrations/telegram/audit?limit=1"),
      ]);
      setStats({
        groupCount: groups.items.length,
        userCount: users.items.length,
        commandCount: audit.total,
        lastWebhook: s.lastWebhookAt,
      });
    } catch { setStatus(null); }
    finally { setLoading(false); }
  }
  useEffect(() => { loadStatus(); }, []);

  function generateSecret() {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    const bytes = new Uint32Array(32);
    if (typeof window !== "undefined" && window.crypto) window.crypto.getRandomValues(bytes);
    const secret = Array.from(bytes, (n) => chars[n % chars.length]).join("");
    setForm((f) => ({ ...f, webhookSecret: secret }));
    toast.success("Generated a new webhook secret — click Save Configuration to store it.");
  }

  async function save() {
    setSaving(true);
    try {
      if (form.webhookSecret && !/^[A-Za-z0-9_-]{1,256}$/.test(form.webhookSecret)) {
        toast.error("Webhook Secret can only contain letters, numbers, underscores (_) and hyphens (-) — no spaces or symbols. Use the Generate button instead.");
        setSaving(false);
        return;
      }
      const update: any = {};
      if (form.botToken) update.botToken = form.botToken;
      if (form.botUsername !== undefined) update.botUsername = form.botUsername;
      if (form.webhookUrl !== undefined) update.webhookUrl = form.webhookUrl;
      if (form.webhookSecret) update.webhookSecret = form.webhookSecret;
      update.defaultLanguage = form.defaultLanguage;
      await api.put("/api/v1/integrations/telegram/config", update);
      toast.success("Telegram config saved");
      loadStatus();
    } catch (e) { toast.error((e as Error).message); }
    finally { setSaving(false); }
  }

  const tabs = [
    { key: "overview", label: "Overview", icon: Activity },
    { key: "config", label: "Config", icon: Settings },
    { key: "groups", label: "Groups", icon: Users },
    { key: "users", label: "Users", icon: MessageCircle },
    { key: "notifications", label: "Notifications", icon: Bell },
    { key: "activity", label: "Activity", icon: Zap },
  ] as const;

  return (
    <div>
      <PageHeader title="Telegram Bot" description="Quick operational control center. Group → Role → Permission mapping." breadcrumb="System → Integrations" />

      {/* Bot status hero */}
      <div className={`rounded-2xl border p-5 mb-5 fade-in-up relative overflow-hidden ${status?.connected ? "border-emerald-500/30 bg-gradient-to-br from-emerald-500/5 to-transparent" : "border-amber-500/30 bg-gradient-to-br from-amber-500/5 to-transparent"}`}>
        <div className="flex items-center gap-4">
          <div className={`h-14 w-14 rounded-2xl flex items-center justify-center shrink-0 ${status?.connected ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600"}`}>
            <Send className="h-7 w-7" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold">Z-CRM Bot</h2>
              <StatusBadge status={status?.status ?? "DISCONNECTED"} />
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              {status?.connected ? (
                <>Connected as <span className="font-medium text-foreground">{status.botUsername ?? "bot"}</span> · Token: <span className="font-mono text-xs">{status.botTokenMasked || "—"}</span></>
              ) : (
                <>Bot not configured — enter a bot token in the Config tab to connect.</>
              )}
            </p>
          </div>
          {status?.connected && (
            <div className="hidden sm:flex items-center gap-1.5 text-emerald-600">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-medium">Live</span>
            </div>
          )}
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <QuickStat icon={Users} label="Groups" value={stats.groupCount} tone="blue" />
        <QuickStat icon={MessageCircle} label="Users" value={stats.userCount} tone="violet" />
        <QuickStat icon={Zap} label="Commands Sent" value={stats.commandCount} tone="emerald" />
        <QuickStat icon={Activity} label="Last Webhook" value={stats.lastWebhook ? formatDate(stats.lastWebhook).slice(0, 16) : "Never"} tone="cyan" />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 border-b overflow-x-auto no-scrollbar">
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <button key={t.key} onClick={() => setTab(t.key)} className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap flex items-center gap-1.5 ${tab === t.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
              <Icon className="h-3.5 w-3.5" /> {t.label}
            </button>
          );
        })}
      </div>

      {tab === "overview" && <OverviewTab status={status} stats={stats} onTab={setTab} />}
      {tab === "config" && (
        <div className="grid lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-2 shadow-soft card-hover">
            <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Settings className="h-4 w-4" /> Bot Configuration</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div><Label>Bot Token (server-only — never returned to client)</Label><Input type="password" value={form.botToken} onChange={(e) => setForm({ ...form, botToken: e.target.value })} placeholder={status?.botTokenMasked ? `${status.botTokenMasked} (stored)` : "123456:ABC-DEF..."} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Bot Username</Label><Input value={form.botUsername} onChange={(e) => setForm({ ...form, botUsername: e.target.value })} placeholder="@zcrm_bot" /></div>
                <div><Label>Default Language</Label>
                  <Select value={form.defaultLanguage} onValueChange={(v) => setForm({ ...form, defaultLanguage: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="en">🇬🇧 English</SelectItem><SelectItem value="bn">🇧🇩 Bangla</SelectItem></SelectContent></Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Webhook URL</Label><Input value={form.webhookUrl} onChange={(e) => setForm({ ...form, webhookUrl: e.target.value })} placeholder="https://your-domain.com/api/v1/integrations/telegram/webhook" /></div>
                <div><Label>Webhook Secret</Label>
                  <div className="flex gap-1.5">
                    <Input type="password" value={form.webhookSecret} onChange={(e) => setForm({ ...form, webhookSecret: e.target.value })} placeholder={status?.webhookUrl ? "•••• stored" : "letters, numbers, _ and - only"} />
                    <Button type="button" variant="outline" size="sm" onClick={generateSecret}>Generate</Button>
                  </div>
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button onClick={save} disabled={saving}><Save className="h-4 w-4 mr-1" /> {saving ? "Saving…" : "Save Configuration"}</Button>
                <Button variant="outline" onClick={setWebhook} disabled={settingWebhook}><Link2 className="h-4 w-4 mr-1" /> {settingWebhook ? "Setting…" : "Set Webhook on Telegram"}</Button>
                <Button variant="outline" onClick={checkWebhook} disabled={checkingWebhook}><Radio className="h-4 w-4 mr-1" /> {checkingWebhook ? "Checking…" : "Check Webhook Status"}</Button>
              </div>
              {webhookResult && (
                <div className={`rounded-lg p-3 text-sm ${webhookResult.ok ? "bg-emerald-500/10 text-emerald-700" : "bg-red-500/10 text-red-700"}`}>
                  {webhookResult.ok ? "✅ Webhook set successfully! Telegram will now send updates to your webhook URL." : `❌ ${webhookResult.error}`}
                </div>
              )}
            </CardContent>
          </Card>
          <div className="space-y-4">
            <Card className="shadow-soft card-hover">
              <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Link2 className="h-4 w-4" /> Webhook URL</CardTitle></CardHeader>
              <CardContent>
                <code className="block p-2 rounded bg-muted text-xs break-all">{typeof window !== "undefined" ? `${window.location.origin}/api/v1/integrations/telegram/webhook` : "/api/v1/integrations/telegram/webhook"}</code>
                <Button variant="ghost" size="sm" className="mt-2 h-7 text-xs" onClick={() => { const url = typeof window !== "undefined" ? `${window.location.origin}/api/v1/integrations/telegram/webhook` : ""; navigator.clipboard.writeText(url); toast.success("Copied"); }}><Copy className="h-3.5 w-3.5 mr-1" /> Copy URL</Button>
                <p className="text-xs text-muted-foreground mt-1">Set this as your bot's webhook URL via @BotFather or the Telegram API.</p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {tab === "groups" && <GroupsTab />}
      {tab === "users" && <UsersTab />}
      {tab === "notifications" && <NotificationsTab />}
      {tab === "activity" && <ActivityTab />}
    </div>
  );
}

function QuickStat({ icon: Icon, label, value, tone }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string | number; tone: string }) {
  const tones: Record<string, string> = {
    blue: "from-blue-500/15 to-blue-500/5 text-blue-600 ring-blue-500/20",
    violet: "from-violet-500/15 to-violet-500/5 text-violet-600 ring-violet-500/20",
    emerald: "from-emerald-500/15 to-emerald-500/5 text-emerald-600 ring-emerald-500/20",
    cyan: "from-cyan-500/15 to-cyan-500/5 text-cyan-600 ring-cyan-500/20",
  };
  return (
    <div className="rounded-xl border border-border/80 bg-card p-4 shadow-soft card-hover">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider truncate">{label}</p>
          <p className="text-xl md:text-2xl font-bold tracking-tight mt-1 tabular-nums">{value}</p>
        </div>
        <div className={`h-10 w-10 rounded-xl bg-gradient-to-br flex items-center justify-center ring-1 shrink-0 ${tones[tone]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function OverviewTab({ status, stats, onTab }: { status: any; stats: any; onTab: (t: any) => void }) {
  const webhookUrl = typeof window !== "undefined" ? `${window.location.origin}/api/v1/integrations/telegram/webhook` : "/api/v1/integrations/telegram/webhook";
  return (
    <div className="space-y-4">
      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="shadow-soft card-hover">
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Zap className="h-4 w-4" /> Setup Guide</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Step n={1} title="Create a bot" done={!!status?.connected}>
              Open <a href="https://t.me/BotFather" target="_blank" rel="noopener" className="text-primary underline">@BotFather</a> in Telegram, send <code className="text-xs bg-muted px-1 rounded">/newbot</code>, get the bot token.
            </Step>
            <Step n={2} title="Enter the token" done={!!status?.connected}>
              Go to the <button onClick={() => onTab("config")} className="text-primary underline">Config tab</button> and paste the bot token + username.
            </Step>
            <Step n={3} title="Set the webhook URL" done={!!status?.webhookUrl}>
              Copy the webhook URL below and set it via <code className="text-xs bg-muted px-1 rounded">/setwebhook</code> in BotFather or the Telegram API.
            </Step>
            <Step n={4} title="Add groups" done={stats.groupCount > 0}>
              Go to the <button onClick={() => onTab("groups")} className="text-primary underline">Groups tab</button> and add your Telegram groups with role assignments.
            </Step>
            <Step n={5} title="Add the bot to your group" done={false}>
              In Telegram, add the bot to your group and send <code className="text-xs bg-muted px-1 rounded">/start</code>.
            </Step>
            <Step n={6} title="Configure notifications" done={false}>
              Go to the <button onClick={() => onTab("notifications")} className="text-primary underline">Notifications tab</button> to route CRM events to groups.
            </Step>
          </CardContent>
        </Card>
        <Card className="shadow-soft card-hover">
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Link2 className="h-4 w-4" /> Webhook & Connection</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between"><span className="text-muted-foreground">Connection Status</span><StatusBadge status={status?.status ?? "DISCONNECTED"} /></div>
            <div className="flex items-center justify-between"><span className="text-muted-foreground">Bot Username</span><span className="font-medium">{status?.botUsername ?? "—"}</span></div>
            <div className="flex items-center justify-between"><span className="text-muted-foreground">Token (masked)</span><span className="font-mono text-xs">{status?.botTokenMasked || "not set"}</span></div>
            <div className="flex items-center justify-between"><span className="text-muted-foreground">Groups</span><span className="font-medium">{stats.groupCount}</span></div>
            <div className="flex items-center justify-between"><span className="text-muted-foreground">Users</span><span className="font-medium">{stats.userCount}</span></div>
            <div className="flex items-center justify-between"><span className="text-muted-foreground">Last Webhook</span><span className="text-xs">{stats.lastWebhook ? formatDate(stats.lastWebhook) : "Never"}</span></div>
            <div className="pt-2 border-t border-border/60">
              <p className="text-xs text-muted-foreground mb-1">Webhook URL:</p>
              <code className="block p-2 rounded bg-muted text-xs break-all">{webhookUrl}</code>
              <Button variant="ghost" size="sm" className="mt-2 h-7 text-xs" onClick={() => { navigator.clipboard.writeText(webhookUrl); toast.success("Copied"); }}><Copy className="h-3.5 w-3.5 mr-1" /> Copy URL</Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-soft card-hover">
        <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><MessageCircle className="h-4 w-4" /> Available Commands</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 text-xs">
            {["/start", "/help", "/orders", "/deliveries", "/customers", "/due", "/inbox", "/payments", "/returns", "/leads", "/pipeline", "/products", "/inventory", "/movements", "/stockcount", "/warehouses", "/transfers", "/purchases", "/suppliers", "/expenses", "/cash", "/reports", "/notifications"].map((c) => (
              <div key={c} className="rounded-lg bg-muted/50 px-2.5 py-1.5 font-mono">{c}</div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-3">Commands shown depend on the user's role in the current group. Sensitive actions (status change, stock adjust, approve, convert) require a confirmation tap.</p>
        </CardContent>
      </Card>
    </div>
  );
}

function Step({ n, title, done, children }: { n: number; title: string; done: boolean; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 ${done ? "bg-emerald-500/15 text-emerald-600" : "bg-muted text-muted-foreground"}`}>
        {done ? <CheckCircle2 className="h-4 w-4" /> : n}
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{children}</p>
      </div>
    </div>
  );
}

function GroupsTab() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ chatId: "", chatTitle: "", roleName: "SALES" });

  async function load() {
    setLoading(true);
    try { const res = await api.get<{ items: any[] }>("/api/v1/integrations/telegram/groups"); setRows(res.items); }
    catch (e) { toast.error((e as Error).message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function create() {
    try { await api.post("/api/v1/integrations/telegram/groups", f); toast.success("Group added"); setOpen(false); setF({ chatId: "", chatTitle: "", roleName: "SALES" }); load(); }
    catch (e) { toast.error((e as Error).message); }
  }
  async function updateGroup(id: string, data: any) {
    try { await api.put(`/api/v1/integrations/telegram/groups/${id}`, data); load(); }
    catch (e) { toast.error((e as Error).message); }
  }
  async function del(id: string) {
    if (!confirm("Delete this group?")) return;
    try { await api.del(`/api/v1/integrations/telegram/groups/${id}`); toast.success("Deleted"); load(); }
    catch (e) { toast.error((e as Error).message); }
  }

  return (
    <div>
      <div className="flex justify-end mb-3">
        <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" /> Add Group</Button>
      </div>
      <div className="space-y-2">
        {loading ? <div className="text-center text-muted-foreground py-8">Loading…</div> :
         rows.length === 0 ? <div className="text-center text-muted-foreground py-8">No Telegram groups configured.</div> :
         rows.map((g) => (
           <Card key={g.id} className="shadow-soft card-hover">
             <CardContent className="p-3 flex items-center justify-between">
               <div>
                 <div className="font-medium flex items-center gap-2">{g.chatTitle} <Badge variant="outline" className="text-xs">{g.roleName}</Badge></div>
                 <div className="text-xs text-muted-foreground font-mono mt-0.5">{g.chatId} · {g._count?.memberships ?? 0} members · {g._count?.notifications ?? 0} rules</div>
               </div>
               <div className="flex items-center gap-2">
                <Select value={g.roleName} onValueChange={(v) => updateGroup(g.id, { roleName: v })}><SelectTrigger className="w-32 h-8"><SelectValue /></SelectTrigger><SelectContent>{ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent></Select>
                <Switch checked={g.isActive} onCheckedChange={(c) => updateGroup(g.id, { isActive: c })} />
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => del(g.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
               </div>
             </CardContent>
           </Card>
         ))}
      </div>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setOpen(false)}>
          <Card className="w-full max-w-md shadow-pop" onClick={(e) => e.stopPropagation()}>
            <CardContent className="p-4 space-y-3">
              <h3 className="font-semibold">Add Telegram Group</h3>
              <div><Label>Chat ID (numeric — from your Telegram group URL)</Label><Input value={f.chatId} onChange={(e) => setF({ ...f, chatId: e.target.value })} placeholder="-5337403276" /></div>
              <div><Label>Group Name</Label><Input value={f.chatTitle} onChange={(e) => setF({ ...f, chatTitle: e.target.value })} placeholder="Z-CRM Admin" /></div>
              <div><Label>Default Role (for this group)</Label>
                <Select value={f.roleName} onValueChange={(v) => setF({ ...f, roleName: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent></Select>
              </div>
              <Button onClick={create} disabled={!f.chatId || !f.chatTitle}>Add Group</Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function UsersTab() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try { const res = await api.get<{ items: any[] }>("/api/v1/integrations/telegram/users"); if (!cancelled) setRows(res.items); }
      catch (e) { if (!cancelled) toast.error((e as Error).message); }
      finally { if (!cancelled) setLoading(false); }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  return (
    <div>
      <p className="text-sm text-muted-foreground mb-3">Telegram users are auto-registered when they send a command to the bot. Their role in each group determines their permissions.</p>
      <div className="rounded-xl border border-border/80 overflow-hidden bg-card shadow-soft">
        <table className="w-full text-sm">
          <thead className="bg-muted/40"><tr><th className="text-left font-semibold text-muted-foreground px-4 py-3 text-xs uppercase tracking-wider">Name</th><th className="text-left font-semibold text-muted-foreground px-4 py-3 text-xs uppercase tracking-wider">Telegram ID</th><th className="text-left font-semibold text-muted-foreground px-4 py-3 text-xs uppercase tracking-wider">Groups & Roles</th></tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">Loading…</td></tr> :
             rows.length === 0 ? <tr><td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">No Telegram users yet. They appear here automatically when someone messages the bot.</td></tr> :
             rows.map((u) => (
               <tr key={u.id} className="border-t border-border/60 hover:bg-muted/30">
                 <td className="px-4 py-3"><div className="font-medium">{u.firstName ?? "Unknown"}</div><div className="text-xs text-muted-foreground">@{u.username ?? "—"}</div></td>
                 <td className="px-4 py-3 font-mono text-xs">{u.telegramId}</td>
                 <td className="px-4 py-3">{u.memberships?.map((m: any) => <Badge key={m.id} variant="outline" className="mr-1 text-xs">{m.group?.chatTitle} · {m.roleName}</Badge>) ?? "—"}</td>
               </tr>
             ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function NotificationsTab() {
  const [groups, setGroups] = useState<any[]>([]);
  const [rules, setRules] = useState<any[]>([]);
  const [selectedGroup, setSelectedGroup] = useState("");

  useEffect(() => {
    let cancelled = false;
    const doLoad = async () => {
      const [g, r] = await Promise.all([
        api.get<{ items: any[] }>("/api/v1/integrations/telegram/groups"),
        api.get<{ items: any[] }>("/api/v1/integrations/telegram/notifications/rules"),
      ]);
      if (cancelled) return;
      setGroups(g.items);
      setRules(r.items);
      if (g.items[0] && !selectedGroup) setSelectedGroup(g.items[0].id);
    };
    doLoad();
    return () => { cancelled = true; };
  }, []);

  async function toggleRule(groupId: string, eventType: string, isActive: boolean) {
    try {
      await api.post("/api/v1/integrations/telegram/notifications/rules", { groupId, eventType, isActive });
      const r = await api.get<{ items: any[] }>("/api/v1/integrations/telegram/notifications/rules");
      setRules(r.items);
    }
    catch (e) { toast.error((e as Error).message); }
  }

  const groupRules = rules.filter((r) => r.groupId === selectedGroup);
  const activeEventTypes = new Set(groupRules.filter((r) => r.isActive).map((r) => r.eventType));

  return (
    <div>
      <div className="mb-4">
        <Select value={selectedGroup} onValueChange={setSelectedGroup}><SelectTrigger className="w-64"><SelectValue placeholder="Select group" /></SelectTrigger><SelectContent>{groups.map((g) => <SelectItem key={g.id} value={g.id}>{g.chatTitle}</SelectItem>)}</SelectContent></Select>
      </div>
      {selectedGroup && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
          {EVENT_TYPES.map((evt) => (
            <div key={evt} className="flex items-center justify-between rounded-lg border border-border/60 p-3 card-hover">
              <div>
                <div className="text-sm font-medium">{EVENT_LABELS[evt] ?? evt}</div>
                <div className="text-xs text-muted-foreground">{activeEventTypes.has(evt) ? "✅ Active" : "Inactive"}</div>
              </div>
              <Switch checked={activeEventTypes.has(evt)} onCheckedChange={(c) => toggleRule(selectedGroup, evt, c)} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ActivityTab() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try { const res = await api.get<{ items: any[] }>("/api/v1/integrations/telegram/audit?limit=30"); if (!cancelled) setRows(res.items); }
      catch (e) { if (!cancelled) toast.error((e as Error).message); }
      finally { if (!cancelled) setLoading(false); }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="rounded-xl border border-border/80 overflow-hidden bg-card shadow-soft">
      <table className="w-full text-sm">
        <thead className="bg-muted/40"><tr><th className="text-left font-semibold text-muted-foreground px-4 py-3 text-xs uppercase tracking-wider">When</th><th className="text-left font-semibold text-muted-foreground px-4 py-3 text-xs uppercase tracking-wider">Action</th><th className="text-left font-semibold text-muted-foreground px-4 py-3 text-xs uppercase tracking-wider">Command</th><th className="text-left font-semibold text-muted-foreground px-4 py-3 text-xs uppercase tracking-wider">User</th><th className="text-left font-semibold text-muted-foreground px-4 py-3 text-xs uppercase tracking-wider">Group</th></tr></thead>
        <tbody>
          {loading ? <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Loading…</td></tr> :
           rows.length === 0 ? <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No Telegram activity yet.</td></tr> :
           rows.map((a) => (
             <tr key={a.id} className="border-t border-border/60 hover:bg-muted/30">
               <td className="px-4 py-3 text-xs text-muted-foreground">{formatDate(a.createdAt)}</td>
               <td className="px-4 py-3"><Badge variant="outline" className="text-xs">{a.action}</Badge></td>
               <td className="px-4 py-3 text-xs font-mono">{a.command ?? "—"}</td>
               <td className="px-4 py-3 text-xs">{a.user?.firstName ?? a.telegramUserId ?? "—"}</td>
               <td className="px-4 py-3 text-xs">{a.group?.chatTitle ?? "—"}</td>
             </tr>
           ))}
        </tbody>
      </table>
    </div>
  );
}

void XCircle;
