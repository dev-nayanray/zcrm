"use client";
import { useEffect, useState } from "react";
import { api, money, num } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Plus, Send, Zap } from "lucide-react";
import { PageHeader, DataTable, StatusBadge } from "../ui";
import { toast } from "sonner";
import { formatDate } from "@/lib/date-range";

const EVENTS = ["ORDER_CREATED", "PAYMENT_RECEIVED", "STOCK_LOW", "LEAD_CREATED", "ORDER_DELIVERED", "ORDER_SHIPPED", "ORDER_CANCELLED", "DUE_PAYMENT"];
const ACTIONS = ["SEND_WHATSAPP_TEMPLATE", "CREATE_NOTIFICATION", "ASSIGN_SALES_USER", "CONVERT_RESERVATION"];
const ROLES = ["MANAGER", "SALES", "INVENTORY", "ACCOUNTANT"];

export function AutomationView() {
  const [rows, setRows] = useState<any[]>([]);
  const [execs, setExecs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: "", event: "ORDER_CREATED", action: "CREATE_NOTIFICATION", templateName: "", targetRole: "" });

  async function load() {
    setLoading(true);
    try {
      const [r, e] = await Promise.all([api.get<{ items: any[] }>("/api/v1/automation-rules"), api.get<{ items: any[] }>("/api/v1/automation-executions?limit=10")]);
      setRows(r.items); setExecs(e.items);
    } catch (e) { toast.error((e as Error).message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function toggle(rule: any) {
    try { await api.patch(`/api/v1/automation-rules/${rule.id}`, { isActive: !rule.isActive }); load(); }
    catch (e) { toast.error((e as Error).message); }
  }
  async function create() {
    try { await api.post("/api/v1/automation-rules", { ...f, templateName: f.templateName || undefined, targetRole: f.targetRole || undefined }); toast.success("Rule created"); setOpen(false); load(); }
    catch (e) { toast.error((e as Error).message); }
  }

  return (
    <div>
      <PageHeader title="Automation Engine" description="Event → Rule → Action → Execution Log. Automation NEVER blocks the main business transaction (fire-and-forget after commit)." action={
        <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" /> New Rule</Button>
      } />
      <div className="grid lg:grid-cols-2 gap-4">
        <div>
          <h3 className="text-sm font-semibold mb-2">Rules</h3>
          {rows.length === 0 ? <div className="text-sm text-muted-foreground py-6 text-center">No automation rules yet</div> : (
            <div className="space-y-2">
              {rows.map((r) => (
                <Card key={r.id}><CardContent className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2"><Zap className="h-3.5 w-3.5 text-primary" /><span className="font-medium">{r.name}</span><StatusBadge status={r.isActive ? "ACTIVE" : "INACTIVE"} /></div>
                      <div className="text-xs text-muted-foreground mt-1">{r.event} → {r.action}{r.templateName ? ` · ${r.templateName}` : ""}{r.targetRole ? ` → ${r.targetRole}` : ""}</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">{r._count?.executions ?? 0} executions</div>
                    </div>
                    <Switch checked={r.isActive} onCheckedChange={() => toggle(r)} />
                  </div>
                </CardContent></Card>
              ))}
            </div>
          )}
        </div>
        <div>
          <h3 className="text-sm font-semibold mb-2">Recent Executions</h3>
          {execs.length === 0 ? <div className="text-sm text-muted-foreground py-6 text-center">No executions yet</div> : (
            <div className="rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50"><tr><th className="text-left px-2 py-1.5">Rule</th><th className="text-left px-2 py-1.5">Status</th><th className="text-left px-2 py-1.5">When</th></tr></thead>
                <tbody>
                  {execs.map((e) => (
                    <tr key={e.id} className="border-t">
                      <td className="px-2 py-1.5 text-xs">{e.rule?.name ?? "—"}</td>
                      <td className="px-2 py-1.5"><StatusBadge status={e.status} /></td>
                      <td className="px-2 py-1.5 text-xs text-muted-foreground">{formatDate(e.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setOpen(false)}>
          <Card className="w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <CardHeader><CardTitle className="text-base">New Automation Rule</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div><label className="text-xs">Name</label><input className="w-full rounded border p-2 text-sm" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Order Confirmation WhatsApp" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs">Event</label>
                  <Select value={f.event} onValueChange={(v) => setF({ ...f, event: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{EVENTS.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent></Select>
                </div>
                <div><label className="text-xs">Action</label>
                  <Select value={f.action} onValueChange={(v) => setF({ ...f, action: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{ACTIONS.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent></Select>
                </div>
              </div>
              {f.action === "SEND_WHATSAPP_TEMPLATE" && <div><label className="text-xs">Template Name</label><input className="w-full rounded border p-2 text-sm" value={f.templateName} onChange={(e) => setF({ ...f, templateName: e.target.value })} placeholder="order_confirmed" /></div>}
              {f.action === "ASSIGN_SALES_USER" && <div><label className="text-xs">Target Role</label>
                <Select value={f.targetRole} onValueChange={(v) => setF({ ...f, targetRole: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent></Select>
              </div>}
              <Button onClick={create} disabled={!f.name}><Send className="h-4 w-4 mr-1" /> Create Rule</Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

void money; void num;
