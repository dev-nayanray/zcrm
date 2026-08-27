"use client";
import { useEffect, useState } from "react";
import { api, money, num } from "@/lib/api-client";
import { useCrmStore } from "@/lib/store";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GitBranch, ArrowLeft, ArrowRight } from "lucide-react";
import { PageHeader, StatusBadge } from "../ui";
import { toast } from "sonner";
import { formatDate } from "@/lib/date-range";

const STAGES = ["NEW", "CONTACTED", "QUALIFIED", "NEGOTIATION", "ORDER_CREATED", "WON", "LOST"];

export function LeadPipelineView() {
  const { navigate } = useCrmStore();
  const [pipeline, setPipeline] = useState<any>({});
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const [p, l] = await Promise.all([
        api.get("/api/v1/leads/pipeline"),
        api.get<{ items: any[] }>("/api/v1/leads?limit=100"),
      ]);
      setPipeline(p);
      setLeads(l.items);
    } catch (e) { toast.error((e as Error).message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function moveStage(leadId: string, stage: string) {
    try { await api.patch(`/api/v1/leads/${leadId}`, { pipelineStage: stage }); load(); }
    catch (e) { toast.error((e as Error).message); }
  }

  return (
    <div>
      <PageHeader title="Lead Pipeline" description="Meta leads through the sales funnel. NEW → CONTACTED → QUALIFIED → NEGOTIATION → ORDER_CREATED → WON/LOST." />
      {loading ? <div className="p-8 text-center text-muted-foreground">Loading pipeline…</div> : (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2 overflow-x-auto">
          {STAGES.map((stage) => {
            const stageLeads = leads.filter((l) => (l.followUp?.pipelineStage ?? (l.status === "CONVERTED" ? "WON" : "NEW")) === stage);
            const stat = pipeline[stage] ?? { count: stageLeads.length, value: "0.00" };
            return (
              <div key={stage} className="rounded-md border bg-card flex flex-col min-w-[180px]">
                <div className="p-2 border-b bg-muted/40">
                  <div className="flex items-center justify-between"><span className="text-xs font-semibold">{stage}</span><span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">{stat.count}</span></div>
                </div>
                <div className="p-2 space-y-2 flex-1 overflow-y-auto max-h-[60vh]">
                  {stageLeads.length === 0 ? <div className="text-xs text-muted-foreground text-center py-4">No leads</div> :
                    stageLeads.map((l) => (
                      <div key={l.id} className="rounded border p-2 text-xs bg-background">
                        <button onClick={() => navigate("leads", {})} className="font-medium hover:underline block truncate">{l.name}</button>
                        <div className="text-muted-foreground">{l.phone ?? "—"}</div>
                        {l.campaign && <div className="text-muted-foreground">{l.campaign}</div>}
                        <StatusBadge status={l.status} />
                        <div className="flex gap-1 mt-1">
                          {STAGES.indexOf(stage) > 0 && <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => moveStage(l.id, STAGES[STAGES.indexOf(stage) - 1])}><ArrowLeft className="h-3 w-3" /></Button>}
                          {STAGES.indexOf(stage) < STAGES.length - 1 && <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => moveStage(l.id, STAGES[STAGES.indexOf(stage) + 1])}><ArrowRight className="h-3 w-3" /></Button>}
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

void GitBranch; void Card; void CardContent; void money; void num; void Select; void SelectContent; void SelectItem; void SelectTrigger; void SelectValue; void formatDate;
