"use client";
import { useEffect, useState } from "react";
import { api, num } from "@/lib/api-client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download } from "lucide-react";
import { PageHeader, DataTable, StatusBadge } from "../ui";
import { toast } from "sonner";
import { formatDate } from "@/lib/date-range";

type Movement = { id: string; productId: string; type: string; quantityChange: string; previousQuantity: string; newQuantity: string; referenceType?: string | null; referenceId?: string | null; reason?: string | null; createdBy?: string | null; creator?: { name: string } | null; product?: { name: string; sku: string }; createdAt: string };

export function StockMovementsView() {
  const [rows, setRows] = useState<Movement[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(25);
  const [search, setSearch] = useState("");
  const [type, setType] = useState("ALL");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      p.set("page", String(page)); p.set("limit", String(limit));
      if (search) p.set("productId", search); // search by product id-ish (best effort)
      if (type !== "ALL") p.set("type", type);
      const res = await api.get<{ items: Movement[]; total: number }>(`/api/v1/stock-movements?${p}`);
      setRows(res.items); setTotal(res.total);
    } catch (e) { toast.error((e as Error).message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [page, type]);

  return (
    <div>
      <PageHeader title="Stock Movements" description="The complete inventory ledger. Every stock change is traceable here." action={
        <Select value={type} onValueChange={(v) => { setType(v); setPage(1); }}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All types</SelectItem>
            <SelectItem value="PURCHASE">Purchase</SelectItem>
            <SelectItem value="SALE">Sale</SelectItem>
            <SelectItem value="RETURN">Return</SelectItem>
            <SelectItem value="DAMAGE">Damage</SelectItem>
            <SelectItem value="ADJUSTMENT">Adjustment</SelectItem>
            <SelectItem value="TRANSFER_IN">Transfer In</SelectItem>
            <SelectItem value="TRANSFER_OUT">Transfer Out</SelectItem>
            <SelectItem value="RESERVATION">Reservation</SelectItem>
            <SelectItem value="RELEASE">Release</SelectItem>
          </SelectContent>
        </Select>
      } />
      <DataTable<Movement>
        rows={rows} loading={loading} page={page} totalPages={Math.ceil(total / limit) || 1} total={total} limit={limit}
        onPage={setPage} search={search} onSearch={(v) => { setSearch(v); }}
        columns={[
          { key: "date", header: "Date", render: (r) => <span className="text-xs">{formatDate(r.createdAt)}</span> },
          { key: "type", header: "Type", render: (r) => <StatusBadge status={r.type} /> },
          { key: "product", header: "Product", render: (r) => <div><div className="font-medium">{r.product?.name ?? "—"}</div><div className="text-xs text-muted-foreground">{r.product?.sku ?? ""}</div></div> },
          { key: "change", header: "Change", render: (r) => <span className={num(r.quantityChange) >= 0 ? "text-emerald-600 font-medium" : "text-red-600 font-medium"}>{num(r.quantityChange) >= 0 ? "+" : ""}{r.quantityChange}</span> },
          { key: "prev", header: "Previous", render: (r) => r.previousQuantity },
          { key: "new", header: "New", render: (r) => r.newQuantity },
          { key: "ref", header: "Reference", render: (r) => r.referenceType ? <span className="text-xs text-muted-foreground">{r.referenceType}{r.referenceId ? ` · …${r.referenceId.slice(-6)}` : ""}</span> : "—" },
          { key: "reason", header: "Reason", render: (r) => r.reason || "—" },
          { key: "by", header: "By", render: (r) => r.creator?.name ?? "—" },
        ]}
      />
    </div>
  );
}

void Download;
