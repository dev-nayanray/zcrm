"use client";
import { useEffect, useState } from "react";
import { api, money, num } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download } from "lucide-react";
import { PageHeader } from "../ui";
import { toast } from "sonner";

type PnL = {
  grossSales: string; discounts: string; shippingCost: string; otherCost: string;
  revenue: string; refunds: string; netRevenue: string; cogs: string;
  grossProfit: string; operatingExpenses: string; netProfit: string;
  paidTotal: string; outstanding: string; orderCount: number;
};

export function ProfitLossView() {
  const [data, setData] = useState<PnL | null>(null);
  const [preset, setPreset] = useState("this_month");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (from && to) { params.set("from", from); params.set("to", to); }
      else params.set("preset", preset);
      const r = await api.get<PnL>(`/api/v1/reports/profit-loss?${params}`);
      setData(r);
    } catch (e) { toast.error((e as Error).message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [preset, from, to]);

  const np = num(data?.netProfit);
  const gp = num(data?.grossProfit);

  return (
    <div>
      <PageHeader title="Profit & Loss" description="Net Profit = Revenue − COGS − Order Costs − Operating Expenses − Refunds. Uses the centralized AccountingService." action={
        <Button variant="outline" size="sm" onClick={() => window.open(`/api/v1/exports/profit-loss?type=profit-loss?${from && to ? `from=${from}&to=${to}` : `preset=${preset}`}`, "_blank")}><Download className="h-4 w-4 mr-1" /> CSV</Button>
      } />

      <Card className="mb-4">
        <CardContent className="p-3 flex flex-wrap items-end gap-3">
          <div><Label className="text-xs">Preset</Label>
            <Select value={preset} onValueChange={setPreset}><SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Today</SelectItem><SelectItem value="yesterday">Yesterday</SelectItem>
                <SelectItem value="this_week">This week</SelectItem><SelectItem value="this_month">This month</SelectItem>
                <SelectItem value="last_month">Last month</SelectItem><SelectItem value="this_year">This year</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="text-xs text-muted-foreground">— or —</div>
          <div><Label className="text-xs">From</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" /></div>
          <div><Label className="text-xs">To</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" /></div>
        </CardContent>
      </Card>

      {loading ? <div className="text-muted-foreground py-8 text-center">Calculating…</div> : (
        <div className="grid lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Revenue</CardTitle></CardHeader>
            <CardContent className="space-y-1 text-sm">
              <Row label="Gross Sales" value={money(data?.grossSales)} />
              <Row label="Discounts" value={`- ${money(data?.discounts)}`} muted />
              <Row label="Shipping Charged" value={`+ ${money(data?.shippingCost)}`} />
              <Row label="Other Costs Charged" value={`+ ${money(data?.otherCost)}`} />
              <div className="flex justify-between font-bold border-t pt-1"><span>Revenue</span><span>{money(data?.revenue)}</span></div>
              <Row label="Refunds" value={`- ${money(data?.refunds)}`} muted />
              <div className="flex justify-between font-medium"><span>Net Revenue</span><span>{money(data?.netRevenue)}</span></div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Costs & Profit</CardTitle></CardHeader>
            <CardContent className="space-y-1 text-sm">
              <Row label="COGS (historical snapshots)" value={`- ${money(data?.cogs)}`} muted />
              <div className={`flex justify-between font-bold border-t pt-1 ${gp >= 0 ? "text-emerald-600" : "text-red-600"}`}><span>Gross Profit</span><span>{money(data?.grossProfit)}</span></div>
              <Row label="Operating Expenses" value={`- ${money(data?.operatingExpenses)}`} muted />
              <Row label="Refunds" value={`- ${money(data?.refunds)}`} muted />
              <div className={`flex justify-between font-bold border-t pt-1 text-lg ${np >= 0 ? "text-emerald-600" : "text-red-600"}`}><span>Net Profit</span><span>{money(data?.netProfit)}</span></div>
              <div className="flex justify-between text-xs text-muted-foreground pt-1">
                <span>Profit Margin</span>
                <span className="font-medium">{num(data?.revenue) > 0 ? `${(np / num(data?.revenue) * 100).toFixed(1)}%` : "—"}</span>
              </div>
            </CardContent>
          </Card>
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2"><CardTitle className="text-base">Additional KPIs</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <KPI label="Orders" value={String(data?.orderCount ?? 0)} />
              <KPI label="Total Paid" value={money(data?.paidTotal)} />
              <KPI label="Outstanding" value={money(data?.outstanding)} />
              <KPI label="Avg Order Value" value={money(num(data?.revenue) / (data?.orderCount || 1))} />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return <div className="flex justify-between"><span className="text-muted-foreground">{label}</span><span className={muted ? "text-red-600" : ""}>{value}</span></div>;
}

function KPI({ label, value }: { label: string; value: string }) {
  return <div className="rounded-md bg-muted/30 p-2"><div className="text-xs text-muted-foreground">{label}</div><div className="font-semibold text-lg">{value}</div></div>;
}
