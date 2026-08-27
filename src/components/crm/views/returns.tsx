"use client";
import { useEffect, useState } from "react";
import { api, money, num } from "@/lib/api-client";
import { useCrmStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Plus, ArrowLeft } from "lucide-react";
import { PageHeader, DataTable, StatusBadge } from "../ui";
import { toast } from "sonner";
import { formatDate } from "@/lib/date-range";

type Ret = { id: string; status: string; type: string; reason?: string | null; refundAmount: string; order: { id: string; orderNumber: string }; customer: { id: string; name: string }; items: { id: string; product: { name: string; sku: string }; quantity: string; condition: string }[]; createdAt: string };

export function ReturnsView() {
  const { navigate } = useCrmStore();
  const [rows, setRows] = useState<Ret[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(15);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const res = await api.get<{ items: Ret[]; total: number }>(`/api/v1/returns?page=${page}&limit=${limit}`);
      setRows(res.items); setTotal(res.total);
    } catch (e) { toast.error((e as Error).message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [page]);

  return (
    <div>
      <PageHeader title="Returns" description="Full, partial & exchange returns. Stock is automatically adjusted via Stock Movements." />
      <DataTable<Ret>
        rows={rows} loading={loading} page={page} totalPages={Math.ceil(total / limit) || 1} total={total} limit={limit} onPage={setPage}
        onRowClick={(r) => navigate("orders/detail", { id: r.order.id })}
        emptyMessage="No returns yet. Create returns from an order's detail page."
        columns={[
          { key: "order", header: "Order", render: (r) => <span className="font-medium">{r.order.orderNumber}</span> },
          { key: "customer", header: "Customer", render: (r) => r.customer.name },
          { key: "items", header: "Items", render: (r) => r.items.length },
          { key: "refund", header: "Refund", render: (r) => num(r.refundAmount) > 0 ? money(r.refundAmount) : "—" },
          { key: "type", header: "Type", render: (r) => r.type },
          { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
          { key: "date", header: "Date", render: (r) => <span className="text-xs text-muted-foreground">{formatDate(r.createdAt)}</span> },
        ]}
      />
    </div>
  );
}
