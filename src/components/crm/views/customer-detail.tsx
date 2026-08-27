"use client";
import { useEffect, useState } from "react";
import { api, money, num } from "@/lib/api-client";
import { useCrmStore } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Phone, Mail, MapPin, ShoppingCart, Wallet, MessageSquare, UserPlus } from "lucide-react";
import { PageHeader, StatusBadge } from "../ui";
import { toast } from "sonner";
import { formatDate } from "@/lib/date-range";

type Detail = {
  id: string; name: string; phone: string; email?: string | null; address?: string | null; city?: string | null; notes?: string | null; externalId?: string | null;
  totalOrders: number; totalSpending: string; totalPaid: string; outstanding: string; lifetimeValue: string;
  orders: { id: string; orderNumber: string; status: string; paymentStatus: string; total: any; createdAt: string; channel?: { name: string } }[];
  payments: { id: string; amount: any; method: string; createdAt: string }[];
  returns: any[];
};

export function CustomerDetailView() {
  const { params, navigate } = useCrmStore();
  const [data, setData] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    if (!params.id) return;
    setLoading(true);
    try {
      const r = await api.get<Detail>(`/api/v1/customers/${params.id}`);
      setData(r);
    } catch (e) { toast.error((e as Error).message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [params.id]);

  const [creditOpen, setCreditOpen] = useState(false);
  const [creditAmount, setCreditAmount] = useState(0);

  async function recordAdvance() {
    if (creditAmount <= 0) { toast.error("Enter an amount"); return; }
    try {
      await api.post("/api/v1/customer-credit", { customerId: params.id, action: "advance", amount: creditAmount, notes: "Customer advance payment" });
      toast.success("Advance recorded");
      setCreditOpen(false); setCreditAmount(0); load();
    } catch (e) { toast.error((e as Error).message); }
  }

  if (loading) return <div className="p-8 text-center text-muted-foreground">Loading…</div>;
  if (!data) return <div className="p-8 text-center">Not found</div>;

  const convs: any[] = (data as any).conversations ?? [];
  const leads: any[] = (data as any).leads ?? [];

  return (
    <div>
      <PageHeader title={data.name} description={`Customer since ${formatDate(data.orders[data.orders.length - 1]?.createdAt ?? new Date())}`} action={
        <Button variant="ghost" size="sm" onClick={() => navigate("customers")}><ArrowLeft className="h-4 w-4 mr-1" /> Back</Button>
      } />
      <div className="grid lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Contact</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" />{data.phone}</div>
            {data.email && <div className="flex items-center gap-2"><Mail className="h-4 w-4 text-muted-foreground" />{data.email}</div>}
            {data.address && <div className="flex items-start gap-2"><MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />{data.address}</div>}
            {data.city && <div className="text-muted-foreground">{data.city}</div>}
            {data.notes && <div className="mt-2 p-2 rounded bg-muted text-xs">{data.notes}</div>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Lifetime Value</CardTitle>
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setCreditOpen(!creditOpen)}>Add Advance</Button>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <Row label="Orders" value={data.totalOrders} />
            <Row label="Total Spending" value={money(data.totalSpending)} />
            <Row label="Total Paid" value={money(data.totalPaid)} />
            <div className="flex justify-between font-medium text-amber-600"><span>Outstanding</span><span>{money(data.outstanding)}</span></div>
            <div className="flex justify-between font-bold border-t pt-1"><span>LTV (paid)</span><span>{money(data.lifetimeValue)}</span></div>
            {creditOpen && (
              <div className="flex gap-2 pt-2 mt-1 border-t border-border/60">
                <Input type="number" placeholder="Advance amount" value={creditAmount || ""} onChange={(e) => setCreditAmount(num(e.target.value))} className="h-8 text-sm" />
                <Button size="sm" className="h-8 shrink-0" onClick={recordAdvance}>Save</Button>
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Recent Orders</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => navigate("orders/new")}>New Order</Button>
          </CardHeader>
          <CardContent>
            {data.orders.length === 0 ? <div className="text-sm text-muted-foreground">No orders yet</div> : (
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {data.orders.slice(0, 10).map((o) => (
                  <button key={o.id} onClick={() => navigate("orders/detail", { id: o.id })} className="w-full flex items-center justify-between text-sm py-1.5 px-2 rounded hover:bg-accent">
                    <div className="flex items-center gap-2"><StatusBadge status={o.status} /><span className="font-medium">{o.orderNumber}</span></div>
                    <span className="text-xs text-muted-foreground">{money(o.total)}</span>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-4 mt-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><ShoppingCart className="h-4 w-4" /> Order History</CardTitle></CardHeader>
          <CardContent>
            <div className="rounded-md border overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50"><tr><th className="text-left px-2 py-1.5">Order</th><th className="text-left px-2 py-1.5">Status</th><th className="text-right px-2 py-1.5">Total</th><th className="text-left px-2 py-1.5">Date</th></tr></thead>
                <tbody>
                  {data.orders.map((o) => (
                    <tr key={o.id} className="border-t hover:bg-muted/40 cursor-pointer" onClick={() => navigate("orders/detail", { id: o.id })}>
                      <td className="px-2 py-1.5 font-medium">{o.orderNumber}</td>
                      <td className="px-2 py-1.5"><StatusBadge status={o.status} /></td>
                      <td className="px-2 py-1.5 text-right">{money(o.total)}</td>
                      <td className="px-2 py-1.5 text-xs text-muted-foreground">{formatDate(o.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Wallet className="h-4 w-4" /> Payment History</CardTitle></CardHeader>
          <CardContent>
            <div className="rounded-md border overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50"><tr><th className="text-right px-2 py-1.5">Amount</th><th className="text-left px-2 py-1.5">Method</th><th className="text-left px-2 py-1.5">Date</th></tr></thead>
                <tbody>
                  {data.payments.map((p) => (
                    <tr key={p.id} className="border-t">
                      <td className="px-2 py-1.5 text-right font-medium">{money(p.amount)}</td>
                      <td className="px-2 py-1.5">{p.method}</td>
                      <td className="px-2 py-1.5 text-xs text-muted-foreground">{formatDate(p.createdAt)}</td>
                    </tr>
                  ))}
                  {data.payments.length === 0 && <tr><td colSpan={3} className="px-2 py-4 text-center text-muted-foreground">No payments</td></tr>}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Customer 360° — Conversations & Leads */}
      <div className="grid lg:grid-cols-2 gap-4 mt-4">
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base flex items-center gap-2"><MessageSquare className="h-4 w-4" /> Conversations</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => navigate("inbox")}>View inbox</Button>
          </CardHeader>
          <CardContent>
            {convs.length === 0 ? <p className="text-sm text-muted-foreground py-4 text-center">No conversations linked</p> : (
              <div className="space-y-1">
                {convs.map((c: any) => (
                  <button key={c.id} onClick={() => navigate("inbox/detail", { id: c.id })} className="w-full flex items-center justify-between text-sm py-1.5 px-2 rounded hover:bg-accent">
                    <div className="flex items-center gap-2"><span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground">{c.provider}</span><span className="font-medium">{c.contactName}</span></div>
                    <span className="text-xs text-muted-foreground truncate max-w-[180px]">{c.lastMessagePreview || "—"}</span>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base flex items-center gap-2"><UserPlus className="h-4 w-4" /> Meta Leads</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => navigate("leads")}>View leads</Button>
          </CardHeader>
          <CardContent>
            {leads.length === 0 ? <p className="text-sm text-muted-foreground py-4 text-center">No leads linked</p> : (
              <div className="space-y-1">
                {leads.map((l: any) => (
                  <div key={l.id} className="flex items-center justify-between text-sm py-1.5 px-2 border-b last:border-0">
                    <div><span className="font-medium">{l.name}</span>{l.campaign && <span className="ml-2 text-xs text-muted-foreground">{l.campaign}</span>}</div>
                    <span className="text-xs text-muted-foreground">{l.status}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | number }) {
  return <div className="flex justify-between"><span className="text-muted-foreground">{label}</span><span className="font-medium">{value}</span></div>;
}
