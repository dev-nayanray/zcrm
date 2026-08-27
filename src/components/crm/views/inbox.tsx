"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { useCrmStore } from "@/lib/store";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessageCircle, Search, MessageSquare, Phone } from "lucide-react";
import { PageHeader, StatusBadge, EmptyState } from "../ui";
import { toast } from "sonner";
import { formatDate } from "@/lib/date-range";

type Conv = {
  id: string; provider: string; contactName?: string; contactPhone?: string; status: string;
  unreadCount: number; lastMessageAt?: string | null; lastMessagePreview?: string | null;
  customer?: { id: string; name: string; phone: string } | null;
  channel?: { id: string; name: string } | null;
  assignee?: { id: string; name: string } | null;
  _count?: { messages: number };
};

const providerLabel: Record<string, string> = { whatsapp: "WhatsApp", facebook: "Facebook", instagram: "Instagram", messenger: "Messenger" };

export function InboxView() {
  const { navigate, params } = useCrmStore();
  const [rows, setRows] = useState<Conv[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [provider, setProvider] = useState(params.provider || "ALL");
  const [status, setStatus] = useState("ALL");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      p.set("page", String(page)); p.set("limit", "20");
      if (search) p.set("search", search);
      if (provider !== "ALL") p.set("provider", provider);
      if (status !== "ALL") p.set("status", status);
      const res = await api.get<{ items: Conv[]; total: number }>(`/api/v1/conversations?${p}`);
      setRows(res.items); setTotal(res.total);
    } catch (e) { toast.error((e as Error).message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [page, provider, status]);
  useEffect(() => { setPage(1); load(); }, [search]);

  return (
    <div>
      <PageHeader title="Omnichannel Inbox" description="WhatsApp, Facebook Messenger & Instagram conversations unified. Convert any conversation into an order — same OrderService." action={
        <Select value={provider} onValueChange={(v) => { setProvider(v); setPage(1); }}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All channels</SelectItem>
            <SelectItem value="whatsapp">WhatsApp</SelectItem>
            <SelectItem value="facebook">Facebook</SelectItem>
            <SelectItem value="instagram">Instagram</SelectItem>
          </SelectContent>
        </Select>
      } />

      <div className="flex gap-2 mb-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search conversations…" className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All statuses</SelectItem>
            <SelectItem value="OPEN">Open</SelectItem>
            <SelectItem value="PENDING">Pending</SelectItem>
            <SelectItem value="RESOLVED">Resolved</SelectItem>
            <SelectItem value="CLOSED">Closed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={MessageCircle} title="No conversations" description="Inbound WhatsApp / Facebook messages will appear here." />
      ) : (
        <div className="space-y-2">
          {rows.map((c) => (
            <button key={c.id} onClick={() => navigate("inbox/detail", { id: c.id })} className="w-full text-left">
              <Card className="hover:shadow-md transition-shadow">
                <CardContent className="p-3 flex items-center gap-3">
                  <div className={`h-10 w-10 rounded-full flex items-center justify-center text-white shrink-0 ${c.provider === "whatsapp" ? "bg-emerald-500" : c.provider === "facebook" ? "bg-blue-600" : "bg-gradient-to-tr from-fuchsia-500 to-amber-400"}`}>
                    {c.provider === "whatsapp" ? <Phone className="h-5 w-5" /> : <MessageSquare className="h-5 w-5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{c.contactName || c.customer?.name || "Unknown"}</span>
                      {c.contactPhone && <span className="text-xs text-muted-foreground">{c.contactPhone}</span>}
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground">{providerLabel[c.provider] ?? c.provider}</span>
                      <StatusBadge status={c.status} />
                    </div>
                    <p className="text-sm text-muted-foreground truncate">{c.lastMessagePreview || "No messages yet"}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xs text-muted-foreground">{c.lastMessageAt ? formatDate(c.lastMessageAt) : "—"}</div>
                    {c.unreadCount > 0 && <div className="mt-1 inline-flex items-center justify-center h-5 min-w-5 px-1.5 text-[10px] font-semibold bg-primary text-primary-foreground rounded-full">{c.unreadCount}</div>}
                    {c.assignee && <div className="text-[10px] text-muted-foreground mt-1">@{c.assignee.name}</div>}
                  </div>
                </CardContent>
              </Card>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
