"use client";
import { useEffect, useState } from "react";
import { api, money, num } from "@/lib/api-client";
import { useCrmStore } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader, StatusBadge } from "../ui";
import { toast } from "sonner";
import { Boxes, AlertTriangle, PackageX, TrendingUp, TrendingDown, Warehouse, Layers, DollarSign } from "lucide-react";

type Data = {
  totalProducts: number; totalUnits: string; totalReserved: string; totalDamaged: string; totalAvailable: string;
  totalCostValue: string; totalRetailValue: string;
  lowStockCount: number; outOfStockCount: number; damagedCount: number;
  lowStock: { productId: string; name: string; sku: string; available: string; reorderLevel: string }[];
  outOfStock: { productId: string; name: string; sku: string }[];
  damaged: { productId: string; name: string; sku: string; damagedQuantity: string }[];
  movementSummary: { stockIn: string; stockOut: string; movementCount: number };
};

export function InventoryDashboardView() {
  const { navigate } = useCrmStore();
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<Data>("/api/v1/inventory/dashboard").then(setData).catch((e) => toast.error((e as Error).message)).finally(() => setLoading(false));
  }, []);

  if (loading || !data) return <div className="p-8 text-center text-muted-foreground">Loading inventory dashboard…</div>;

  const kpis = [
    { label: "Total Products", value: String(data.totalProducts), icon: Boxes, color: "text-blue-600" },
    { label: "Total Units", value: num(data.totalUnits).toLocaleString(), icon: Layers, color: "text-cyan-600" },
    { label: "Available Stock", value: num(data.totalAvailable).toLocaleString(), icon: Warehouse, color: "text-emerald-600" },
    { label: "Reserved Stock", value: num(data.totalReserved).toLocaleString(), icon: Layers, color: "text-amber-600" },
    { label: "Damaged Stock", value: num(data.totalDamaged).toLocaleString(), icon: AlertTriangle, color: "text-red-600" },
    { label: "Stock Value (cost)", value: money(data.totalCostValue), icon: DollarSign, color: "text-emerald-600" },
    { label: "Stock Value (retail)", value: money(data.totalRetailValue), icon: DollarSign, color: "text-cyan-600" },
    { label: "Movements Today", value: String(data.movementSummary.movementCount), icon: TrendingUp, color: "text-purple-600" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Inventory Dashboard" description="Total stock, valuation, reservations, damaged, and today's movement summary." />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <Card key={k.label}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="text-xs text-muted-foreground font-medium">{k.label}</div>
                  <Icon className={`h-4 w-4 ${k.color}`} />
                </div>
                <div className="mt-1 text-xl md:text-2xl font-bold">{k.value}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base flex items-center gap-2"><TrendingUp className="h-4 w-4 text-emerald-600" /> Stock In Today</CardTitle>
            <div className="text-2xl font-bold text-emerald-600">{num(data.movementSummary.stockIn).toLocaleString()}</div>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">Units received via purchases/returns/transfers today.</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base flex items-center gap-2"><TrendingDown className="h-4 w-4 text-red-600" /> Stock Out Today</CardTitle>
            <div className="text-2xl font-bold text-red-600">{num(data.movementSummary.stockOut).toLocaleString()}</div>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">Units sold / damaged / transferred out today.</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-500" /> Reorder Alerts</CardTitle>
            <div className="text-2xl font-bold text-amber-600">{data.lowStockCount + data.outOfStockCount}</div>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">Products at or below their reorder level.</CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-500" /> Low Stock ({data.lowStockCount})</CardTitle>
            <button className="text-xs text-primary hover:underline" onClick={() => navigate("inventory", { status: "low" })}>View all</button>
          </CardHeader>
          <CardContent>
            {data.lowStock.length === 0 ? <p className="text-sm text-muted-foreground py-4 text-center">No low-stock products</p> : (
              <div className="space-y-1 max-h-60 overflow-y-auto">
                {data.lowStock.map((p) => (
                  <div key={p.productId} className="flex items-center justify-between text-sm py-1.5 px-2 border-b last:border-0">
                    <div><div className="font-medium">{p.name}</div><div className="text-xs text-muted-foreground">{p.sku}</div></div>
                    <div className="text-right"><div className="text-amber-600 font-medium">{p.available} avail</div><div className="text-xs text-muted-foreground">reorder @ {p.reorderLevel}</div></div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base flex items-center gap-2"><PackageX className="h-4 w-4 text-red-500" /> Out of Stock ({data.outOfStockCount})</CardTitle>
            <button className="text-xs text-primary hover:underline" onClick={() => navigate("inventory", { status: "out" })}>View all</button>
          </CardHeader>
          <CardContent>
            {data.outOfStock.length === 0 ? <p className="text-sm text-muted-foreground py-4 text-center">No out-of-stock products</p> : (
              <div className="space-y-1 max-h-60 overflow-y-auto">
                {data.outOfStock.map((p) => (
                  <div key={p.productId} className="flex items-center justify-between text-sm py-1.5 px-2 border-b last:border-0">
                    <div><div className="font-medium">{p.name}</div><div className="text-xs text-muted-foreground">{p.sku}</div></div>
                    <StatusBadge status="OUT_OF_STOCK" />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
