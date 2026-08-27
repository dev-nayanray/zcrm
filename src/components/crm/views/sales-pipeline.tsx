"use client";
import { useEffect, useState } from "react";
import { api, money, num } from "@/lib/api-client";
import { useCrmStore } from "@/lib/store";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, GitBranch, Plus } from "lucide-react";
import { PageHeader, StatusBadge } from "../ui";
import { toast } from "sonner";

const STAGES = ["NEW", "CONTACTED", "QUALIFIED", "NEGOTIATION", "ORDER_CREATED", "WON", "LOST"];

export function SalesPipelineView() {
  const { navigate } = useCrmStore();
  const [pipeline, setPipeline] = useState<any>({});
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const [p, e] = await Promise.all([
        api.get("/api/v1/sales-pipeline/pipeline"),
        api.get<{ items: any[] }>("/api/v1/sales-pipeline?limit=100"),
      ]);
      setPipeline(p);
      setEntries(e.items);
    } catch (err) { toast.error((err as Error).message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function moveStage(id: string, stage: string) {
    try { await api.patch(`/api/v1/sales-pipeline/${id}`, { stage }); load(); }
    catch (e) { toast.error((e as Error).message); }
  }

  const totalValue = entries.filter((e) => e.stage !== "LOST").reduce((s, e) => s + num(e.value), 0);

  return (
    <div>
      <PageHeader title="Sales Pipeline" description="Lightweight sales pipeline reusing Customer + Order (no separate CRM architecture)." action={
        <div className="text-right"><div className="text-xs text-muted-foreground">Pipeline Value</div><div className="text-lg font-bold">{money(totalValue.toFixed(2))}</div></div>
      } />
      {loading ? <div className="p-8 text-center text-muted-foreground">Loading pipeline…</div> : (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2 overflow-x-auto">
          {STAGES.map((stage) => {
            const stageEntries = entries.filter((e) => e.stage === stage);
            const stat = pipeline[stage] ?? { count: 0, value: "0.00" };
            return (
              <div key={stage} className="rounded-md border bg-card flex flex-col min-w-[200px]">
                <div className="p-2 border-b bg-muted/40">
                  <div className="flex items-center justify-between"><span className="text-xs font-semibold">{stage}</span><span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">{stat.count}</span></div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">{money(stat.value)}</div>
                </div>
                <div className="p-2 space-y-2 flex-1 overflow-y-auto max-h-[60vh]">
                  {stageEntries.length === 0 ? <div className="text-xs text-muted-foreground text-center py-4">No deals</div> :
                    stageEntries.map((e) => (
                      <div key={e.id} className="rounded border p-2 text-xs bg-background">
                        <button onClick={() => navigate("customers/detail", { id: e.customerId })} className="font-medium hover:underline block truncate">{e.customer?.name}</button>
                        <div className="text-muted-foreground">{money(e.value)}</div>
                        {e.assignedTo && <div className="text-muted-foreground">@{e.assignedTo.name}</div>}
                        <div className="flex gap-1 mt-1">
                          {STAGES.indexOf(stage) > 0 && <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => moveStage(e.id, STAGES[STAGES.indexOf(stage) - 1])}><ArrowLeft className="h-3 w-3" /></Button>}
                          {STAGES.indexOf(stage) < STAGES.length - 1 && <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => moveStage(e.id, STAGES[STAGES.indexOf(stage) + 1])}><ArrowRight className="h-3 w-3" /></Button>}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

void GitBranch; void Plus; void Card; void CardContent;
