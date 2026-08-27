"use client";
import { useEffect, useState } from "react";
import { api, money } from "@/lib/api-client";
import { useCrmStore } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Truck, Check, Phone } from "lucide-react";
import { PageHeader, StatusBadge } from "../ui";
import { toast } from "sonner";
import { formatDate } from "@/lib/date-range";

type Delivery = { id: string; status: string; trackingNumber?: string | null; courierName?: string | null; deliveryCharge: string; codAmount: string; courierConsignmentId?: string | null; recipientName?: string | null; recipientPhone?: string | null; recipientAddress?: string | null; notes?: string | null; order: any; courierProvider?: { id: string; name: string } | null; statusHistory: { id: string; status: string; note?: string | null; createdAt: string }[] };

export function DeliveryDetailView() {
  const { params, navigate } = useCrmStore();
  const [data, setData] = useState<Delivery | null>(null);
  const [loading, setLoading] = useState(true);
  const [newStatus, setNewStatus] = useState("");

  async function load() {
    if (!params.id) return;
    setLoading(true);
    try { const r = await api.get<Delivery>(`/api/v1/deliveries/${params.id}`); setData(r); setNewStatus(r.status); }
    catch (e) { toast.error((e as Error).message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [params.id]);

  async function updateStatus() {
    try { await api.patch(`/api/v1/deliveries/${params.id}`, { status: newStatus }); toast.success("Status updated"); load(); }
    catch (e) { toast.error((e as Error).message); }
  }

  if (loading) return <div className="p-8 text-center text-muted-foreground">Loading delivery…</div>;
  if (!data) return <div className="p-8 text-center">Delivery not found</div>;

  return (
    <div>
      <PageHeader title={`Delivery · ${data.order?.orderNumber ?? "—"}`} description={data.courierProvider?.name ?? data.courierName ?? "No courier assigned"} action={
        <Button variant="ghost" size="sm" onClick={() => navigate("deliveries")}><ArrowLeft className="h-4 w-4 mr-1" /> Back</Button>
      } />
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Truck className="h-4 w-4" /> Delivery Details</CardTitle></CardHeader>
            <CardContent className="space-y-1 text-sm">
              <Row label="Status" value={<StatusBadge status={data.status} />} />
              <Row label="Courier" value={data.courierProvider?.name ?? "—"} />
              <Row label="Tracking #" value={data.trackingNumber ?? "—"} />
              <Row label="Consignment ID" value={data.courierConsignmentId ?? "—"} />
              <Row label="Delivery Charge" value={money(data.deliveryCharge)} />
              <Row label="COD Amount" value={money(data.codAmount)} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Recipient</CardTitle></CardHeader>
            <CardContent className="space-y-1 text-sm">
              <Row label="Name" value={data.recipientName ?? data.order?.customer?.name ?? "—"} />
              <Row label="Phone" value={data.recipientPhone ?? data.order?.customer?.phone ?? "—"} />
              <Row label="Address" value={data.recipientAddress ?? data.order?.customer?.address ?? "—"} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Status History</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-1.5">
                {data.statusHistory.map((h) => (
                  <div key={h.id} className="flex items-center gap-3 text-sm"><StatusBadge status={h.status} />{h.note && <span className="text-muted-foreground">{h.note}</span>}<span className="ml-auto text-xs text-muted-foreground">{formatDate(h.createdAt)}</span></div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Order</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <button onClick={() => data.order && navigate("orders/detail", { id: data.order.id })} className="font-medium text-primary hover:underline">{data.order?.orderNumber}</button>
              <div className="text-muted-foreground">{data.order?.customer?.name}</div>
              <div className="flex justify-between"><span className="text-muted-foreground">Total</span><span className="font-medium">{money(data.order?.total?.toFixed?.(2) ?? "0")}</span></div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Update Status</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["PENDING", "PACKED", "SHIPPED", "IN_TRANSIT", "DELIVERED", "FAILED", "RETURNED"].map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button className="w-full" onClick={updateStatus} disabled={newStatus === data.status}>Save Status</Button>
              <p className="text-[11px] text-muted-foreground">Marking DELIVERED also updates the order to DELIVERED, which converts any reservation to a SALE via the InventoryService.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="flex justify-between"><span className="text-muted-foreground">{label}</span><span className="font-medium">{value}</span></div>;
}

void Phone; void Check;
