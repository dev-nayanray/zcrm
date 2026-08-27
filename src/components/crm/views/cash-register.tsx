"use client";
import { useEffect, useState } from "react";
import { api, money } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Save, Coins } from "lucide-react";
import { PageHeader } from "../ui";
import { toast } from "sonner";

export function CashRegisterView() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [preset, setPreset] = useState("today");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [closing, setClosing] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      if (from && to) { p.set("from", from); p.set("to", to); }
      else p.set("preset", preset);
      setData(await api.get("/api/v1/cash-register?" + p));
    } catch (e) { toast.error((e as Error).message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [preset, from, to]);

  async function closeDay() {
    setClosing(true);
    try { await api.post("/api/v1/cash-register", { date: from || new Date().toISOString().slice(0, 10) }); toast.success("Register closed (snapshot saved)"); load(); }
    catch (e) { toast.error((e as Error).message); }
    finally { setClosing(false); }
  }

  return (
    <div>
      <PageHeader title="Cash Register" description="Cash summary. Opening + Cash Sales + Customer Payments − Refunds − Expenses = Closing. Uses the centralized AccountingService — no duplicate logic." action={
        <Button onClick={closeDay} disabled={closing}><Save className="h-4 w-4 mr-1" /> Close Day</Button>
      } />
      <Card className="mb-4">
        <CardContent className="p-3 flex flex-wrap items-end gap-3">
          <div><Label className="text-xs">Preset</Label>
            <Select value={preset} onValueChange={setPreset}><SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="today">Today</SelectItem><SelectItem value="yesterday">Yesterday</SelectItem><SelectItem value="this_week">This week</SelectItem><SelectItem value="this_month">This month</SelectItem><SelectItem value="this_year">This year</SelectItem></SelectContent>
            </Select>
          </div>
          <div className="text-xs text-muted-foreground">— or —</div>
          <div><Label className="text-xs">From</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" /></div>
          <div><Label className="text-xs">To</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" /></div>
        </CardContent>
      </Card>
      {loading || !data ? <div className="p-8 text-center text-muted-foreground">Calculating…</div> : (
        <div className="grid lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Coins className="h-4 w-4" /> Cash Flow</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Row label="Opening Balance" value={money(data.openingBalance)} />
              <Row label="+ Cash Sales" value={money(data.cashSales)} positive />
              <Row label="+ Customer Payments" value={money(data.customerPayments)} positive />
              <Row label="− Refunds" value={money(data.refunds)} negative />
              <Row label="− Expenses" value={money(data.expenses)} negative />
              <div className="flex justify-between font-bold border-t pt-2 text-base"><span>Closing Balance</span><span>{money(data.closingBalance)}</span></div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Counts</CardTitle></CardHeader>
            <CardContent className="space-y-1 text-sm">
              <Row label="Cash payments" value={data.paymentCount} />
              <Row label="Cash expenses" value={data.expenseCount} />
              <Row label="Cash refunds" value={data.refundCount} />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function Row({ label, value, positive, negative }: { label: string; value: string | number; positive?: boolean; negative?: boolean }) {
  return <div className="flex justify-between"><span className="text-muted-foreground">{label}</span><span className={positive ? "text-emerald-600 font-medium" : negative ? "text-red-600" : "font-medium"}>{typeof value === "number" ? value : money(value)}</span></div>;
}
