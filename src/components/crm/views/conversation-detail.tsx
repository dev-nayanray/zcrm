"use client";
import { useEffect, useState, useRef } from "react";
import { api, money, num } from "@/lib/api-client";
import { useCrmStore } from "@/lib/store";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Send, ShoppingCart, UserPlus, Check } from "lucide-react";
import { PageHeader, StatusBadge } from "../ui";
import { toast } from "sonner";
import { formatDate } from "@/lib/date-range";

type Conv = {
  id: string; provider: string; contactName?: string; contactPhone?: string; status: string; unreadCount: number;
  customer?: { id: string; name: string; phone: string; email?: string | null } | null;
  channel?: { id: string; name: string } | null;
  assignee?: { id: string; name: string } | null;
  messages: { id: string; direction: string; provider: string; body: string; status: string; createdAt: string; sender?: { name: string } | null }[];
  orders: { id: string; orderNumber: string; status: string; total: string; createdAt: string }[];
};

export function ConversationDetailView() {
  const { params, navigate } = useCrmStore();
  const [conv, setConv] = useState<Conv | null>(null);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [users, setUsers] = useState<{ id: string; name: string }[]>([]);
  const [products, setProducts] = useState<{ id: string; name: string; sku: string; sellingPrice: string; stock: string }[]>([]);
  const [orderOpen, setOrderOpen] = useState(false);
  const [prodSearch, setProdSearch] = useState("");
  const [lines, setLines] = useState<{ productId: string; name: string; quantity: number; price: number }[]>([]);
  const [tags, setTags] = useState<{ id: string; tag: string }[]>([]);
  const [notes, setNotes] = useState<{ id: string; body: string; createdBy?: string | null; createdAt: string }[]>([]);
  const [newNote, setNewNote] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const TAG_OPTIONS = ["NEW_LEAD", "EXISTING_CUSTOMER", "ORDER_QUERY", "PAYMENT_QUERY", "COMPLAINT", "RETURN", "VIP"];

  async function loadTagsNotes() {
    if (!params.id) return;
    try {
      const [t, n] = await Promise.all([
        api.get<{ items: { id: string; tag: string }[] }>(`/api/v1/conversations/${params.id}/tags`),
        api.get<{ items: { id: string; body: string; createdBy?: string | null; createdAt: string }[] }>(`/api/v1/conversations/${params.id}/notes`),
      ]);
      setTags(t.items); setNotes(n.items);
    } catch { /* ignore */ }
  }

  async function load() {
    if (!params.id) return;
    setLoading(true);
    try {
      const r = await api.get<Conv>(`/api/v1/conversations/${params.id}`);
      setConv(r);
    } catch (e) { toast.error((e as Error).message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); loadTagsNotes(); }, [params.id]);

  async function toggleTag(tag: string) {
    try {
      if (tags.find((t) => t.tag === tag)) {
        await api.del(`/api/v1/conversations/${params.id}/tags?tag=${tag}`);
      } else {
        await api.post(`/api/v1/conversations/${params.id}/tags`, { tag });
      }
      loadTagsNotes();
    } catch (e) { toast.error((e as Error).message); }
  }
  async function addNote() {
    if (!newNote.trim()) return;
    try {
      await api.post(`/api/v1/conversations/${params.id}/notes`, { body: newNote });
      setNewNote(""); loadTagsNotes();
    } catch (e) { toast.error((e as Error).message); }
  }
  useEffect(() => {
    api.get<{ items: { id: string; name: string }[] }>("/api/v1/users?limit=50").then((r) => setUsers(r.items)).catch(() => {});
  }, []);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [conv?.messages.length]);

  async function send() {
    if (!draft.trim() || !conv) return;
    try {
      await api.post(`/api/v1/conversations/${params.id}/messages`, { body: draft });
      setDraft("");
      load();
    } catch (e) { toast.error((e as Error).message); }
  }

  async function assign(userId: string) {
    try { await api.patch(`/api/v1/conversations/${params.id}`, { assignedUserId: userId }); toast.success("Assigned"); load(); }
    catch (e) { toast.error((e as Error).message); }
  }
  async function setStatus(status: string) {
    try { await api.patch(`/api/v1/conversations/${params.id}`, { status }); toast.success("Status updated"); load(); }
    catch (e) { toast.error((e as Error).message); }
  }

  // order creation from conversation
  useEffect(() => {
    if (!orderOpen) return;
    const t = setTimeout(async () => {
      const r = await api.get<{ items: any[] }>(`/api/v1/products?search=${encodeURIComponent(prodSearch)}&limit=8`);
      setProducts(r.items.map((p) => ({ id: p.id, name: p.name, sku: p.sku, sellingPrice: p.sellingPrice, stock: p.stock })));
    }, 300);
    return () => clearTimeout(t);
  }, [prodSearch, orderOpen]);

  const orderTotal = lines.reduce((s, l) => s + l.quantity * l.price, 0);

  async function createOrder() {
    if (!conv) return;
    if (!conv.customer) { toast.error("Link a customer first"); return; }
    if (lines.length === 0) { toast.error("Add at least one product"); return; }
    try {
      const waChannel = await api.get<{ items: { id: string; name: string }[] }>("/api/v1/channels").then((r) => r.items.find((c) => c.name === (conv.provider === "whatsapp" ? "WhatsApp" : conv.provider === "facebook" ? "Facebook" : "Instagram")));
      const order = await api.post<{ id: string; orderNumber: string }>("/api/v1/orders", {
        customerId: conv.customer.id,
        channelId: waChannel?.id,
        status: "CONFIRMED",
        discount: "0", shippingCost: "0", otherCost: "0",
        reserveStock: true,
        conversationId: conv.id,
        items: lines.map((l) => ({ productId: l.productId, quantity: String(l.quantity), discount: "0" })),
        notes: `Created from ${conv.provider} conversation`,
      });
      toast.success(`Order ${order.orderNumber} created — stock reserved`);
      setOrderOpen(false); setLines([]); setProdSearch("");
      load();
    } catch (e) { toast.error((e as Error).message); }
  }

  if (loading) return <div className="p-8 text-center text-muted-foreground">Loading conversation…</div>;
  if (!conv) return <div className="p-8 text-center">Conversation not found</div>;

  return (
    <div>
      <PageHeader title={conv.contactName || conv.customer?.name || "Conversation"} description={`${conv.provider} · ${conv.contactPhone || conv.customer?.phone || ""}`} action={
        <Button variant="ghost" size="sm" onClick={() => navigate("inbox")}><ArrowLeft className="h-4 w-4 mr-1" /> Back</Button>
      } />

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Messages */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="flex flex-col h-[60vh]">
            <CardContent className="p-3 flex-1 overflow-y-auto space-y-2">
              {conv.messages.map((m) => (
                <div key={m.id} className={`flex ${m.direction === "OUTGOING" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[75%] rounded-lg px-3 py-2 ${m.direction === "OUTGOING" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                    <p className="text-sm whitespace-pre-wrap">{m.body}</p>
                    <div className={`text-[10px] mt-0.5 ${m.direction === "OUTGOING" ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                      {formatDate(m.createdAt)} {m.direction === "OUTGOING" && `· ${m.status}`}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </CardContent>
            <div className="border-t p-3 flex gap-2">
              <Input placeholder="Type a message…" value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} />
              <Button onClick={send}><Send className="h-4 w-4" /></Button>
            </div>
          </Card>
        </div>

        {/* Right column */}
        <div className="space-y-4">
          <Card>
            <CardContent className="p-3 space-y-3">
              <div>
                <p className="text-xs text-muted-foreground">Customer</p>
                {conv.customer ? (
                  <button onClick={() => navigate("customers/detail", { id: conv.customer!.id })} className="font-medium text-primary hover:underline">{conv.customer.name}</button>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => toast.info("Use the Customers page to link a customer, or create one.")}><UserPlus className="h-3.5 w-3.5 mr-1" /> Link customer</Button>
                )}
                {conv.contactPhone && <p className="text-sm text-muted-foreground">{conv.contactPhone}</p>}
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Status</p>
                <Select value={conv.status} onValueChange={setStatus}><SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="OPEN">Open</SelectItem><SelectItem value="PENDING">Pending</SelectItem><SelectItem value="RESOLVED">Resolved</SelectItem><SelectItem value="CLOSED">Closed</SelectItem></SelectContent>
                </Select>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Assigned to</p>
                <Select value={conv.assignee?.id ?? ""} onValueChange={assign}><SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
                  <SelectContent>{users.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <Button className="w-full" onClick={() => setOrderOpen(!orderOpen)}><ShoppingCart className="h-4 w-4 mr-1" /> Create Order</Button>
            </CardContent>
          </Card>

          {orderOpen && (
            <Card>
              <CardContent className="p-3 space-y-2">
                <p className="text-sm font-medium">New Order (stock will be reserved)</p>
                <div className="relative">
                  <Input placeholder="Search products…" value={prodSearch} onChange={(e) => setProdSearch(e.target.value)} />
                  {products.length > 0 && (
                    <div className="absolute z-10 mt-1 w-full rounded-md border bg-popover shadow-md max-h-48 overflow-y-auto">
                      {products.map((p) => (
                        <button key={p.id} onClick={() => { if (lines.find((l) => l.productId === p.id)) setLines((ls) => ls.map((l) => l.productId === p.id ? { ...l, quantity: l.quantity + 1 } : l)); else setLines((ls) => [...ls, { productId: p.id, name: p.name, quantity: 1, price: num(p.sellingPrice) }]); setProdSearch(""); setProducts([]); }} className="block w-full text-left px-2 py-1.5 hover:bg-accent border-b last:border-0 text-sm">
                          <div className="font-medium">{p.name}</div>
                          <div className="text-xs text-muted-foreground">{p.sku} · {money(p.sellingPrice)} · stock {p.stock}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {lines.length > 0 && (
                  <div className="space-y-1">
                    {lines.map((l) => (
                      <div key={l.productId} className="flex items-center gap-2 text-sm">
                        <span className="flex-1 truncate">{l.name}</span>
                        <Input type="number" min="1" value={l.quantity} onChange={(e) => setLines((ls) => ls.map((x) => x.productId === l.productId ? { ...x, quantity: Math.max(1, num(e.target.value)) } : x))} className="w-14 h-7 text-center" />
                        <Input type="number" value={l.price} onChange={(e) => setLines((ls) => ls.map((x) => x.productId === l.productId ? { ...x, price: Math.max(0, num(e.target.value)) } : x))} className="w-20 h-7 text-right" />
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setLines((ls) => ls.filter((x) => x.productId !== l.productId))}>×</Button>
                      </div>
                    ))}
                    <div className="flex justify-between font-bold pt-1 border-t"><span>Total</span><span>{money(orderTotal)}</span></div>
                  </div>
                )}
                <Button className="w-full" onClick={createOrder} disabled={lines.length === 0}>Create & Reserve Stock</Button>
              </CardContent>
            </Card>
          )}

          {conv.orders.length > 0 && (
            <Card>
              <CardContent className="p-3">
                <p className="text-sm font-medium mb-2">Orders from this conversation</p>
                <div className="space-y-1">
                  {conv.orders.map((o) => (
                    <button key={o.id} onClick={() => navigate("orders/detail", { id: o.id })} className="w-full flex items-center justify-between text-sm py-1.5 px-2 rounded hover:bg-accent">
                      <div className="flex items-center gap-2"><StatusBadge status={o.status} /><span className="font-medium">{o.orderNumber}</span></div>
                      <span className="text-xs text-muted-foreground">{money(o.total)}</span>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Conversation tags */}
          <Card>
            <CardContent className="p-3">
              <p className="text-sm font-medium mb-2">Tags</p>
              <div className="flex flex-wrap gap-1.5">
                {TAG_OPTIONS.map((t) => {
                  const active = tags.some((tt) => tt.tag === t);
                  return (
                    <button key={t} onClick={() => toggleTag(t)} className={`text-[11px] px-2 py-1 rounded-full border transition-all ${active ? "bg-primary/10 text-primary border-primary/30" : "border-border/60 text-muted-foreground hover:bg-accent"}`}>
                      {t.replace(/_/g, " ")}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Internal notes */}
          <Card>
            <CardContent className="p-3 space-y-2">
              <p className="text-sm font-medium">Internal Notes</p>
              {notes.length === 0 ? <p className="text-xs text-muted-foreground py-2">No internal notes yet.</p> : (
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {notes.map((n) => (
                    <div key={n.id} className="rounded-lg bg-muted/50 p-2 text-xs">
                      <p className="text-foreground">{n.body}</p>
                      <p className="text-muted-foreground mt-1">{formatDate(n.createdAt)}</p>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <Input placeholder="Add internal note…" value={newNote} onChange={(e) => setNewNote(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addNote(); }} className="h-8 text-sm" />
                <Button size="sm" variant="outline" onClick={addNote} className="h-8 shrink-0">Add</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
