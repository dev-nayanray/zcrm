"use client";
import { useEffect, useState } from "react";
import { api, money, num } from "@/lib/api-client";
import { useCrmStore } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, DollarSign, History, TrendingUp, Wallet, Truck, Plus } from "lucide-react";
import { PageHeader, StatusBadge } from "../ui";
import { toast } from "sonner";
import { formatDate } from "@/lib/date-range";
import { ORDER_STATUS } from "@/lib/constants";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

type Delivery = { id: string; status: string; trackingNumber?: string | null; courierName?: string | null; deliveryCharge: string; codAmount: string; courierProvider?: { id: string; name: string } | null; statusHistory: { id: string; status: string; note?: string | null; createdAt: string }[] };

type OrderDetail = {
  id: string; orderNumber: string; status: string; paymentStatus: string;
  subtotal: string; discount: string; shippingCost: string; otherCost: string; total: string; paidAmount: string; outstanding: string;
  cogs: string; profit: string;
  customer: { id: string; name: string; phone: string; email?: string | null; address?: string | null; city?: string | null };
  channel: { id: string; name: string };
  items: { id: string; productName: string; sku: string; quantity: string; unitPrice: string; unitCost: string; discount: string; total: string; product?: { id: string } }[];
  payments: { id: string; amount: string; method: string; transactionReference?: string | null; createdAt: string; creator?: { name: string } | null }[];
  refunds: { id: string; amount: string; method: string; createdAt: string }[];
  statusHistory: { id: string; status: string; note?: string | null; createdAt: string }[];
  createdAt: string;
};

export function OrderDetailView() {
  const { params, navigate } = useCrmStore();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [delivery, setDelivery] = useState<Delivery | null>(null);
  const [loading, setLoading] = useState(true);
  const [newStatus, setNewStatus] = useState("");
  const [payAmount, setPayAmount] = useState(0);
  const [payMethod, setPayMethod] = useState("CASH");
  const [payRef, setPayRef] = useState("");
  const [deliveryOpen, setDeliveryOpen] = useState(false);
  const [couriers, setCouriers] = useState<{ id: string; name: string }[]>([]);

  async function load() {
    if (!params.id) return;
    setLoading(true);
    try {
      const r = await api.get<OrderDetail>(`/api/v1/orders/${params.id}`);
      setOrder(r);
      setNewStatus(r.status);
      // fetch delivery (404 = none yet, which is fine)
      try { const d = await api.get<Delivery>(`/api/v1/orders/${params.id}/delivery`); setDelivery(d); } catch { setDelivery(null); }
    } catch (e) { toast.error((e as Error).message); }
    finally { setLoading(false); }
  }

  useEffect(() => {
    api.get<{ items: { id: string; name: string }[] }>("/api/v1/couriers").then((r) => setCouriers(r.items)).catch(() => {});
    load();
  }, [params.id]);

  async function updateStatus() {
    try {
      await api.patch(`/api/v1/orders/${params.id}`, { status: newStatus });
      toast.success("Status updated");
      load();
    } catch (e) { toast.error((e as Error).message); }
  }

  async function addPayment() {
    if (payAmount <= 0) { toast.error("Enter an amount"); return; }
    try {
      await api.post(`/api/v1/orders/${params.id}/payments`, { amount: String(payAmount), method: payMethod, transactionReference: payRef });
      toast.success("Payment added");
      setPayAmount(0); setPayRef("");
      load();
    } catch (e) { toast.error((e as Error).message); }
  }

  if (loading) return <div className="p-8 text-center text-muted-foreground">Loading order…</div>;
  if (!order) return <div className="p-8 text-center">Order not found</div>;

  return (
    <div>
      <PageHeader title={order.orderNumber} description={`Created ${formatDate(order.createdAt)}`} action={
        <Button variant="ghost" size="sm" onClick={() => navigate("orders")}><ArrowLeft className="h-4 w-4 mr-1" /> Back</Button>
      } />

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          {/* Items */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Items</CardTitle></CardHeader>
            <CardContent>
              <div className="rounded-md border overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left px-3 py-2">Product</th>
                      <th className="text-right px-3 py-2">Qty</th>
                      <th className="text-right px-3 py-2">Unit Price</th>
                      <th className="text-right px-3 py-2">Disc</th>
                      <th className="text-right px-3 py-2">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {order.items.map((it) => (
                      <tr key={it.id} className="border-t">
                        <td className="px-3 py-2"><div className="font-medium">{it.productName}</div><div className="text-xs text-muted-foreground">{it.sku}</div></td>
                        <td className="px-3 py-2 text-right">{it.quantity}</td>
                        <td className="px-3 py-2 text-right">{money(it.unitPrice)}</td>
                        <td className="px-3 py-2 text-right">{money(it.discount)}</td>
                        <td className="px-3 py-2 text-right font-medium">{money(it.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Payment history */}
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base flex items-center gap-2"><Wallet className="h-4 w-4" /> Payments</CardTitle>
              <StatusBadge status={order.paymentStatus} />
            </CardHeader>
            <CardContent className="space-y-3">
              {order.payments.length === 0 ? <div className="text-sm text-muted-foreground">No payments recorded</div> : (
                <div className="space-y-1">
                  {order.payments.map((p) => (
                    <div key={p.id} className="flex justify-between items-center text-sm border-b last:border-0 py-1.5">
                      <div>
                        <span className="font-medium">{money(p.amount)}</span>
                        <span className="ml-2 text-xs text-muted-foreground">{p.method}</span>
                        {p.transactionReference && <span className="ml-2 text-xs text-muted-foreground">· {p.transactionReference}</span>}
                      </div>
                      <div className="text-xs text-muted-foreground">{formatDate(p.createdAt)}{p.creator ? ` · ${p.creator.name}` : ""}</div>
                    </div>
                  ))}
                </div>
              )}
              {order.refunds.length > 0 && (
                <div className="mt-2">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Refunds</p>
                  {order.refunds.map((r) => (
                    <div key={r.id} className="flex justify-between text-sm text-red-600"><span>- {money(r.amount)} ({r.method})</span><span className="text-xs text-muted-foreground">{formatDate(r.createdAt)}</span></div>
                  ))}
                </div>
              )}
              {/* Add payment */}
              {order.outstanding !== "0.00" && (
                <div className="border-t pt-2 flex flex-col sm:flex-row gap-2 sm:items-end">
                  <div className="flex-1 grid grid-cols-2 gap-2">
                    <div><Label className="text-xs">Amount (Outstanding {money(order.outstanding)})</Label><Input type="number" value={payAmount} onChange={(e) => setPayAmount(Math.max(0, num(e.target.value)))} className="h-9" /></div>
                    <div><Label className="text-xs">Method</Label>
                      <Select value={payMethod} onValueChange={setPayMethod}><SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="CASH">Cash</SelectItem><SelectItem value="BKASH">bKash</SelectItem><SelectItem value="NAGAD">Nagad</SelectItem><SelectItem value="BANK">Bank</SelectItem><SelectItem value="CARD">Card</SelectItem><SelectItem value="OTHER">Other</SelectItem></SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex-1"><Label className="text-xs">Reference</Label><Input value={payRef} onChange={(e) => setPayRef(e.target.value)} className="h-9" placeholder="Txn ID" /></div>
                  <Button onClick={addPayment}><DollarSign className="h-4 w-4 mr-1" /> Add</Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Delivery */}
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base flex items-center gap-2"><Truck className="h-4 w-4" /> Delivery</CardTitle>
              {delivery && <StatusBadge status={delivery.status} />}
            </CardHeader>
            <CardContent>
              {delivery ? (
                <div className="space-y-2 text-sm">
                  <Row label="Courier" value={delivery.courierProvider?.name ?? delivery.courierName ?? "—"} />
                  <Row label="Tracking #" value={delivery.trackingNumber ? <span className="font-mono text-xs">{delivery.trackingNumber}</span> : "—"} />
                  <Row label="Delivery Charge" value={money(delivery.deliveryCharge)} />
                  <Row label="COD Amount" value={money(delivery.codAmount)} />
                  {delivery.statusHistory.length > 0 && (
                    <div className="pt-2 border-t border-border/60">
                      <p className="text-xs text-muted-foreground mb-1.5 font-medium">Delivery tracking</p>
                      <div className="space-y-1">
                        {delivery.statusHistory.map((h) => (
                          <div key={h.id} className="flex items-center gap-2 text-xs">
                            <StatusBadge status={h.status} />
                            {h.note && <span className="text-muted-foreground truncate">{h.note}</span>}
                            <span className="ml-auto text-muted-foreground">{formatDate(h.createdAt)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {delivery.id && (
                    <Button variant="outline" size="sm" className="w-full mt-2" onClick={() => navigate("deliveries/detail", { id: delivery.id })}>View full delivery</Button>
                  )}
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-sm text-muted-foreground mb-3">No delivery created yet.</p>
                  <Dialog open={deliveryOpen} onOpenChange={setDeliveryOpen}>
                    <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" /> Create Delivery</Button></DialogTrigger>
                    <DialogContent><DeliveryForm couriers={couriers} recipientName={order.customer.name} recipientPhone={order.customer.phone} recipientAddress={order.customer.address ?? ""} codAmount={order.total} deliveryCharge={order.shippingCost} onCreate={async (data) => { try { await api.post(`/api/v1/orders/${params.id}/delivery`, data); toast.success("Delivery created"); setDeliveryOpen(false); load(); } catch (e) { toast.error((e as Error).message); } }} /></DialogContent>
                  </Dialog>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Enriched timeline — status + payment + refund + delivery events merged */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><History className="h-4 w-4" /> Order Timeline</CardTitle></CardHeader>
            <CardContent>
              <div className="relative space-y-3 pl-4">
                <div className="absolute left-[5px] top-1 bottom-1 w-px bg-border" />
                {[
                  ...order.statusHistory.map((h) => ({ id: h.id, type: "status" as const, status: h.status, note: h.note, createdAt: h.createdAt })),
                  ...order.payments.map((p) => ({ id: p.id, type: "payment" as const, status: "PAID", note: `Payment ${money(p.amount)} via ${p.method}${p.transactionReference ? ` · ${p.transactionReference}` : ""}`, createdAt: p.createdAt })),
                  ...order.refunds.map((r) => ({ id: r.id, type: "refund" as const, status: "REFUNDED", note: `Refund ${money(r.amount)} via ${r.method}`, createdAt: r.createdAt })),
                ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map((e) => (
                  <div key={e.id} className="relative">
                    <span className={`absolute -left-[14px] top-1.5 h-2.5 w-2.5 rounded-full ring-2 ring-card ${e.type === "payment" ? "bg-emerald-500" : e.type === "refund" ? "bg-fuchsia-500" : "bg-primary"}`} />
                    <div className="flex items-center gap-2 text-sm flex-wrap">
                      <StatusBadge status={e.status} />
                      {e.note && <span className="text-muted-foreground text-xs">{e.note}</span>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{formatDate(e.createdAt)}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Customer */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Customer</CardTitle></CardHeader>
            <CardContent className="space-y-1 text-sm">
              <button onClick={() => navigate("customers/detail", { id: order.customer.id })} className="font-medium text-primary hover:underline">{order.customer.name}</button>
              <div className="text-muted-foreground">{order.customer.phone}</div>
              {order.customer.email && <div className="text-muted-foreground">{order.customer.email}</div>}
              {order.customer.address && <div className="text-muted-foreground">{order.customer.address}</div>}
              {order.customer.city && <div className="text-muted-foreground">{order.customer.city}</div>}
              <div className="mt-2 text-xs text-muted-foreground">Channel: {order.channel.name}</div>
            </CardContent>
          </Card>

          {/* Totals */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Pricing</CardTitle></CardHeader>
            <CardContent className="space-y-1 text-sm">
              <Row label="Subtotal" value={money(order.subtotal)} />
              <Row label="Discount" value={`- ${money(order.discount)}`} />
              <Row label="Shipping" value={`+ ${money(order.shippingCost)}`} />
              <Row label="Other Cost" value={`+ ${money(order.otherCost)}`} />
              <div className="flex justify-between font-bold border-t pt-1"><span>Total</span><span>{money(order.total)}</span></div>
              <Row label="Paid" value={money(order.paidAmount)} />
              <div className="flex justify-between font-medium text-amber-600"><span>Outstanding</span><span>{money(order.outstanding)}</span></div>
            </CardContent>
          </Card>

          {/* Profit */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><TrendingUp className="h-4 w-4" /> Profit Breakdown</CardTitle></CardHeader>
            <CardContent className="space-y-1 text-sm">
              <Row label="Revenue" value={money(order.total)} />
              <Row label="COGS" value={`- ${money(order.cogs)}`} />
              <Row label="Shipping Cost" value={`- ${money(order.shippingCost)}`} />
              <Row label="Other Cost" value={`- ${money(order.otherCost)}`} />
              <div className={`flex justify-between font-bold border-t pt-1 ${num(order.profit) >= 0 ? "text-emerald-600" : "text-red-600"}`}><span>Profit</span><span>{money(order.profit)}</span></div>
              <div className="flex justify-between text-xs text-muted-foreground pt-0.5">
                <span>Profit Margin</span>
                <span className="font-medium">{num(order.total) > 0 ? `${(num(order.profit) / num(order.total) * 100).toFixed(1)}%` : "—"}</span>
              </div>
            </CardContent>
          </Card>

          {/* Update status */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Update Status</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ORDER_STATUS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button className="w-full" onClick={updateStatus} disabled={newStatus === order.status}>Save Status</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="flex justify-between items-center"><span className="text-muted-foreground">{label}</span><span className="font-medium">{value}</span></div>;
}

function DeliveryForm({ couriers, recipientName, recipientPhone, recipientAddress, codAmount, deliveryCharge, onCreate }: {
  couriers: { id: string; name: string }[];
  recipientName: string; recipientPhone: string; recipientAddress: string; codAmount: string; deliveryCharge: string;
  onCreate: (data: any) => void;
}) {
  const [f, setF] = useState({ courierProviderId: couriers[0]?.id ?? "", courierName: "", trackingNumber: "", deliveryCharge, codAmount, recipientName, recipientPhone, recipientAddress, notes: "" });
  return (
    <div>
      <DialogHeader><DialogTitle>Create Delivery</DialogTitle></DialogHeader>
      <div className="space-y-3 py-2">
        <div><Label>Courier</Label>
          <Select value={f.courierProviderId} onValueChange={(v) => setF({ ...f, courierProviderId: v })}><SelectTrigger><SelectValue placeholder="None (manual)" /></SelectTrigger>
            <SelectContent>{couriers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Courier Name (manual)</Label><Input value={f.courierName} onChange={(e) => setF({ ...f, courierName: e.target.value })} placeholder="Pathao / Steadfast" /></div>
          <div><Label>Tracking #</Label><Input value={f.trackingNumber} onChange={(e) => setF({ ...f, trackingNumber: e.target.value })} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Delivery Charge</Label><Input value={f.deliveryCharge} onChange={(e) => setF({ ...f, deliveryCharge: e.target.value })} /></div>
          <div><Label>COD Amount</Label><Input value={f.codAmount} onChange={(e) => setF({ ...f, codAmount: e.target.value })} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Recipient Name</Label><Input value={f.recipientName} onChange={(e) => setF({ ...f, recipientName: e.target.value })} /></div>
          <div><Label>Recipient Phone</Label><Input value={f.recipientPhone} onChange={(e) => setF({ ...f, recipientPhone: e.target.value })} /></div>
        </div>
        <div><Label>Recipient Address</Label><Input value={f.recipientAddress} onChange={(e) => setF({ ...f, recipientAddress: e.target.value })} /></div>
        <div><Label>Notes</Label><Input value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></div>
        <Button onClick={() => onCreate({ ...f, courierProviderId: f.courierProviderId || undefined, courierName: f.courierName || undefined, trackingNumber: f.trackingNumber || undefined, notes: f.notes || undefined })}>Create Delivery</Button>
      </div>
    </div>
  );
}
