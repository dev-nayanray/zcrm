"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { useCrmStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserPlus, Download } from "lucide-react";
import { PageHeader, DataTable, StatusBadge } from "../ui";
import { toast } from "sonner";
import { formatDate } from "@/lib/date-range";

type Lead = { id: string; externalLeadId: string; name: string; phone?: string | null; email?: string | null; source?: string | null; campaign?: string | null; ad?: string | null; form?: string | null; status: string; customer?: { id: string; name: string; phone: string } | null; connection?: { name: string; facebookPageName?: string | null } | null; createdAt: string };

export function LeadsView() {
  const { navigate } = useCrmStore();
  const [rows, setRows] = useState<Lead[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(15);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      p.set("page", String(page)); p.set("limit", String(limit));
      if (search) p.set("search", search);
      if (status !== "ALL") p.set("status", status);
      const res = await api.get<{ items: Lead[]; total: number }>(`/api/v1/leads?${p}`);
      setRows(res.items); setTotal(res.total);
    } catch (e) { toast.error((e as Error).message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [page, status]);
  useEffect(() => { setPage(1); load(); }, [search]);

  async function convertToCustomer(lead: Lead) {
    if (lead.customer) { navigate("customers/detail", { id: lead.customer.id }); return; }
    if (!lead.phone) { toast.error("Lead has no phone number"); return; }
    try {
      const c = await api.post<{ id: string }>("/api/v1/customers", { name: lead.name, phone: lead.phone, email: lead.email, notes: `Converted from Meta Lead ${lead.externalLeadId}` });
      await api.patch(`/api/v1/leads/${lead.id}`, { customerId: c.id, status: "CONTACTED" });
      toast.success("Lead converted to customer");
      load();
    } catch (e) { toast.error((e as Error).message); }
  }

  return (
    <div>
      <PageHeader title="Meta Leads" description="Leads imported from Meta Lead Ads. Convert any lead into a customer — same Customer service." action={
        <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All statuses</SelectItem>
            <SelectItem value="NEW">New</SelectItem>
            <SelectItem value="CONTACTED">Contacted</SelectItem>
            <SelectItem value="CONVERTED">Converted</SelectItem>
            <SelectItem value="ARCHIVED">Archived</SelectItem>
          </SelectContent>
        </Select>
      } />
      <DataTable<Lead>
        rows={rows} loading={loading} page={page} totalPages={Math.ceil(total / limit) || 1} total={total} limit={limit}
        onPage={setPage} search={search} onSearch={setSearch}
        columns={[
          { key: "name", header: "Lead", render: (r) => <div><div className="font-medium">{r.name}</div><div className="text-xs text-muted-foreground">{r.email || "—"}</div></div> },
          { key: "phone", header: "Phone", render: (r) => r.phone || "—" },
          { key: "campaign", header: "Campaign", render: (r) => r.campaign ? <span className="text-xs">{r.campaign}</span> : "—" },
          { key: "source", header: "Source", render: (r) => r.source || r.connection?.facebookPageName || "Meta" },
          { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
          { key: "customer", header: "Customer", render: (r) => r.customer ? <button className="text-primary hover:underline" onClick={(e) => { e.stopPropagation(); navigate("customers/detail", { id: r.customer!.id }); }}>{r.customer.name}</button> : <span className="text-xs text-muted-foreground">Not linked</span> },
          { key: "date", header: "Received", render: (r) => <span className="text-xs text-muted-foreground">{formatDate(r.createdAt)}</span> },
          { key: "actions", header: "", render: (r) => <Button size="sm" variant="outline" className="h-7" onClick={(e) => { e.stopPropagation(); convertToCustomer(r); }}><UserPlus className="h-3.5 w-3.5 mr-1" /> {r.customer ? "View" : "Convert"}</Button> },
        ]}
      />
    </div>
  );
}

void Download;
