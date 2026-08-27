"use client";
import { useEffect, useState } from "react";
import { api, money, num } from "@/lib/api-client";
import { useCrmStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Trash2, Plus, Search, Save, ArrowLeft, ShoppingCart } from "lucide-react";
import { PageHeader } from "../ui";
import { toast } from "sonner";

type Customer = { id: string; name: string; phone: string; email?: string | null; city?: string | null };
type Product = { id: string; name: string; sku: string; sellingPrice: string; stock: string };
type Line = { productId: string; name: string; sku: string; quantity: number; unitPrice: number; discount: number; stock: number };

export function OrderCreateView() {
  const { navigate } = useCrmStore();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [custSearch, setCustSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [prodSearch, setProdSearch] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [discount, setDiscount] = useState(0);
  const [shippingCost, setShippingCost] = useState(0);
  const [otherCost, setOtherCost] = useState(0);
  const [notes, setNotes] = useState("");
  const [channels, setChannels] = useState<{ id: string; name: string }[]>([]);
  const [channelId, setChannelId] = useState("");
  const [payAmount, setPayAmount] = useState(0);
  const [payMethod, setPayMethod] = useState("CASH");
  const [payRef, setPayRef] = useState("");
  const [saving, setSaving] = useState(false);
  const [newCustomerOpen, setNewCustomerOpen] = useState(false);

  useEffect(() => {
    api.get<{ items: { id: string; name: string }[] }>("/api/v1/channels").then((r) => {
      setChannels(r.items);
      const website = r.items.find((c) => c.name === "Website");
      if (website) setChannelId(website.id);
    }).catch(() => {});
  }, []);

  // customer search
  useEffect(() => {
    if (!custSearch) { setCustomers([]); return; }
    const t = setTimeout(async () => {
      try {
        const r = await api.get<{ items: Customer[] }>(`/api/v1/customers?search=${encodeURIComponent(custSearch)}&limit=10`);
        setCustomers(r.items);
      } catch {}
    }, 300);
    return () => clearTimeout(t);
  }, [custSearch]);

  // product search
  useEffect(() => {
    const q = prodSearch;
    const t = setTimeout(async () => {
      try {
        const r = await api.get<{ items: Product[] }>(`/api/v1/products?search=${encodeURIComponent(q)}&limit=10&status=ACTIVE`);
        setProducts(r.items);
      } catch {}
    }, 300);
    return () => clearTimeout(t);
  }, [prodSearch]);

  const subtotal = lines.reduce((s, l) => s + l.quantity * l.unitPrice - l.discount, 0);
  const total = subtotal - discount + shippingCost + otherCost;

  function addProduct(p: Product) {
    if (lines.find((l) => l.productId === p.id)) {
      setLines((ls) => ls.map((l) => l.productId === p.id ? { ...l, quantity: l.quantity + 1 } : l));
    } else {
      setLines((ls) => [...ls, { productId: p.id, name: p.name, sku: p.sku, quantity: 1, unitPrice: num(p.sellingPrice), discount: 0, stock: num(p.stock) }]);
    }
    setProdSearch("");
    setProducts([]);
  }

  function updateLine(id: string, patch: Partial<Line>) {
    setLines((ls) => ls.map((l) => l.productId === id ? { ...l, ...patch } : l));
  }
  function removeLine(id: string) {
    setLines((ls) => ls.filter((l) => l.productId !== id));
  }

  async function save() {
    if (!selectedCustomer) { toast.error("Please select a customer"); return; }
    if (lines.length === 0) { toast.error("Please add at least one product"); return; }
    setSaving(true);
    try {
      const order = await api.post<{ id: string; orderNumber: string }>("/api/v1/orders", {
        customerId: selectedCustomer.id,
        channelId,
        status: "CONFIRMED",
        discount: String(discount),
        shippingCost: String(shippingCost),
        otherCost: String(otherCost),
        notes,
        items: lines.map((l) => ({ productId: l.productId, quantity: String(l.quantity), discount: String(l.discount) })),
        payment: payAmount > 0 ? { amount: String(payAmount), method: payMethod, transactionReference: payRef } : undefined,
      });
      toast.success(`Order ${order.orderNumber} created`);
      navigate("orders/detail", { id: order.id });
    } catch (e) {
      toast.error((e as Error).message);
    } finally { setSaving(false); }
  }

  async function createQuickCustomer(data: { name: string; phone: string; email?: string; address?: string; city?: string }) {
    try {
      const c = await api.post<Customer>("/api/v1/customers", data);
      setSelectedCustomer(c);
      setNewCustomerOpen(false);
      toast.success("Customer created");
    } catch (e) { toast.error((e as Error).message); }
  }

  return (
    <div>
      <PageHeader title="Create New Order" description="Fast offline order creation. Totals are recalculated & validated on the server." action={
        <Button variant="ghost" size="sm" onClick={() => navigate("orders")}><ArrowLeft className="h-4 w-4 mr-1" /> Back</Button>
      } />

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          {/* Customer */}
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">1. Customer</CardTitle>
              <Dialog open={newCustomerOpen} onOpenChange={setNewCustomerOpen}>
                <DialogTrigger asChild><Button variant="outline" size="sm"><Plus className="h-3.5 w-3.5 mr-1" /> New</Button></DialogTrigger>
                <DialogContent><QuickCustomerForm onCreate={createQuickCustomer} /></DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {selectedCustomer ? (
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{selectedCustomer.name}</div>
                    <div className="text-sm text-muted-foreground">{selectedCustomer.phone} {selectedCustomer.email && `· ${selectedCustomer.email}`}</div>
                    {selectedCustomer.city && <div className="text-xs text-muted-foreground">{selectedCustomer.city}</div>}
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedCustomer(null)}>Change</Button>
                </div>
              ) : (
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Search by name, phone or email…" className="pl-8" value={custSearch} onChange={(e) => setCustSearch(e.target.value)} />
                  {customers.length > 0 && (
                    <div className="absolute z-10 mt-1 w-full rounded-md border bg-popover shadow-md max-h-72 overflow-y-auto">
                      {customers.map((c) => (
                        <button key={c.id} onClick={() => { setSelectedCustomer(c); setCustSearch(""); setCustomers([]); }} className="block w-full text-left px-3 py-2 hover:bg-accent border-b last:border-0">
                          <div className="font-medium text-sm">{c.name}</div>
                          <div className="text-xs text-muted-foreground">{c.phone}{c.email ? ` · ${c.email}` : ""}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Products */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">2. Products</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search products by name or SKU…" className="pl-8" value={prodSearch} onChange={(e) => setProdSearch(e.target.value)} />
                {products.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full rounded-md border bg-popover shadow-md max-h-72 overflow-y-auto">
                    {products.map((p) => (
                      <button key={p.id} onClick={() => addProduct(p)} className="block w-full text-left px-3 py-2 hover:bg-accent border-b last:border-0">
                        <div className="font-medium text-sm">{p.name}</div>
                        <div className="text-xs text-muted-foreground flex justify-between">
                          <span>{p.sku}</span><span>{money(p.sellingPrice)} · stock: {p.stock}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {lines.length > 0 && (
                <div className="rounded-md border overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left px-2 py-1.5">Product</th>
                        <th className="text-right px-2 py-1.5">Price</th>
                        <th className="text-center px-2 py-1.5">Qty</th>
                        <th className="text-right px-2 py-1.5">Disc</th>
                        <th className="text-right px-2 py-1.5">Total</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {lines.map((l) => (
                        <tr key={l.productId} className="border-t">
                          <td className="px-2 py-1.5"><div className="font-medium">{l.name}</div><div className="text-xs text-muted-foreground">{l.sku} · stock {l.stock}</div></td>
                          <td className="px-2 py-1.5 text-right"><Input type="number" value={l.unitPrice} onChange={(e) => updateLine(l.productId, { unitPrice: num(e.target.value) })} className="w-20 text-right h-8" /></td>
                          <td className="px-2 py-1.5 text-center"><Input type="number" min="1" value={l.quantity} onChange={(e) => updateLine(l.productId, { quantity: Math.max(1, num(e.target.value)) })} className="w-16 text-center h-8" /></td>
                          <td className="px-2 py-1.5 text-right"><Input type="number" min="0" value={l.discount} onChange={(e) => updateLine(l.productId, { discount: Math.max(0, num(e.target.value)) })} className="w-20 text-right h-8" /></td>
                          <td className="px-2 py-1.5 text-right font-medium">{money(l.quantity * l.unitPrice - l.discount)}</td>
                          <td className="px-2 py-1.5"><Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeLine(l.productId)}><Trash2 className="h-3.5 w-3.5" /></Button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Summary sidebar */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">3. Summary</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <div>
                  <Label className="text-xs">Channel</Label>
                  <Select value={channelId} onValueChange={setChannelId}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Select channel" /></SelectTrigger>
                    <SelectContent>{channels.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label className="text-xs">Discount</Label><Input type="number" value={discount} onChange={(e) => setDiscount(Math.max(0, num(e.target.value)))} className="h-9" /></div>
                  <div><Label className="text-xs">Shipping</Label><Input type="number" value={shippingCost} onChange={(e) => setShippingCost(Math.max(0, num(e.target.value)))} className="h-9" /></div>
                </div>
                <div><Label className="text-xs">Other Cost</Label><Input type="number" value={otherCost} onChange={(e) => setOtherCost(Math.max(0, num(e.target.value)))} className="h-9" /></div>
                <div><Label className="text-xs">Notes</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="min-h-[60px]" /></div>
              </div>
              <div className="border-t pt-2 space-y-1 text-sm">
                <Row label="Subtotal" value={money(subtotal)} />
                <Row label="Discount" value={`- ${money(discount)}`} />
                <Row label="Shipping" value={`+ ${money(shippingCost)}`} />
                <Row label="Other Cost" value={`+ ${money(otherCost)}`} />
                <div className="flex justify-between font-bold text-base pt-1 border-t">
                  <span>Total</span><span>{money(total)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">4. Payment (optional)</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-xs">Amount</Label><Input type="number" value={payAmount} onChange={(e) => setPayAmount(Math.max(0, num(e.target.value)))} className="h-9" /></div>
                <div><Label className="text-xs">Method</Label>
                  <Select value={payMethod} onValueChange={setPayMethod}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CASH">Cash</SelectItem><SelectItem value="BKASH">bKash</SelectItem><SelectItem value="NAGAD">Nagad</SelectItem><SelectItem value="BANK">Bank</SelectItem><SelectItem value="CARD">Card</SelectItem><SelectItem value="OTHER">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label className="text-xs">Reference</Label><Input value={payRef} onChange={(e) => setPayRef(e.target.value)} className="h-9" placeholder="Txn ID / note" /></div>
              <Button className="w-full mt-2" onClick={save} disabled={saving}>
                {saving ? <ShoppingCart className="h-4 w-4 mr-2 animate-pulse" /> : <Save className="h-4 w-4 mr-2" />} Create Order
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between"><span className="text-muted-foreground">{label}</span><span>{value}</span></div>;
}

function QuickCustomerForm({ onCreate }: { onCreate: (data: { name: string; phone: string; email?: string; address?: string; city?: string }) => void }) {
  const [form, setForm] = useState({ name: "", phone: "", email: "", address: "", city: "" });
  return (
    <div>
      <DialogHeader><DialogTitle>New Customer</DialogTitle></DialogHeader>
      <div className="space-y-3 py-2">
        <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
        <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
        <div><Label>Email</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
        <div><Label>Address</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
        <div><Label>City</Label><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
        <Button onClick={() => onCreate({ ...form, email: form.email || undefined })} disabled={!form.name || !form.phone}>Create</Button>
      </div>
    </div>
  );
}
