"use client";
import { useEffect, useState } from "react";
import { api, money } from "@/lib/api-client";
import { useCrmStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download } from "lucide-react";
import { PageHeader, DataTable, StatusBadge } from "../ui";
import { toast } from "sonner";
import { formatDate } from "@/lib/date-range";

type Payment = { id: string; amount: string; method: string; transactionReference?: string | null; order: { id: string; orderNumber: string }; customer: { id: string; name: string; phone: string }; createdAt: string };

export function PaymentsView() {
  const { navigate } = useCrmStore();
  const [rows, setRows] = useState<Payment[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(15);
  const [search, setSearch] = useState("");
  const [method, setMethod] = useState("ALL");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page)); params.set("limit", String(limit));
      if (search) params.set("search", search);
      if (method !== "ALL") params.set("method", method);
      const res = await api.get<{ items: Payment[]; total: number }>(`/api/v1/payments?${params}`);
      setRows(res.items); setTotal(res.total);
    } catch (e) { toast.error((e as Error).message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [page, method]);
  useEffect(() => { setPage(1); load(); }, [search]);

  return (
    <div>
      <PageHeader title="Payments" description="All payments across all orders & customers." action={
        <Button variant="outline" size="sm" onClick={() => window.open("/api/v1/exports/payments?type=payments", "_blank")}><Download className="h-4 w-4 mr-1" /> Export</Button>
      } />
      <DataTable<Payment>
        rows={rows} loading={loading} page={page} totalPages={Math.ceil(total / limit) || 1} total={total} limit={limit}
        onPage={setPage} search={search} onSearch={setSearch}
        toolbar={
          <Select value={method} onValueChange={(v) => { setMethod(v); setPage(1); }}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All methods</SelectItem>
              <SelectItem value="CASH">Cash</SelectItem><SelectItem value="BKASH">bKash</SelectItem><SelectItem value="NAGAD">Nagad</SelectItem><SelectItem value="BANK">Bank</SelectItem><SelectItem value="CARD">Card</SelectItem><SelectItem value="OTHER">Other</SelectItem>
            </SelectContent>
          </Select>
        }
        columns={[
          { key: "order", header: "Order", render: (r) => <button className="font-medium text-primary hover:underline" onClick={(e) => { e.stopPropagation(); navigate("orders/detail", { id: r.order.id }); }}>{r.order.orderNumber}</button> },
          { key: "customer", header: "Customer", render: (r) => <button onClick={(e) => { e.stopPropagation(); navigate("customers/detail", { id: r.customer.id }); }} className="hover:underline"><div className="font-medium">{r.customer.name}</div><div className="text-xs text-muted-foreground">{r.customer.phone}</div></button> },
          { key: "amount", header: "Amount", render: (r) => <span className="font-medium">{money(r.amount)}</span> },
          { key: "method", header: "Method", render: (r) => <StatusBadge status={r.method} /> },
          { key: "ref", header: "Reference", render: (r) => r.transactionReference || "—" },
          { key: "date", header: "Date", render: (r) => <span className="text-xs text-muted-foreground">{formatDate(r.createdAt)}</span> },
        ]}
      />
    </div>
  );
}
