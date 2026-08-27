"use client";
import { useCrmStore, type RouteKey } from "@/lib/store";
import { cn } from "@/lib/utils";
import { useState } from "react";
import {
  LayoutDashboard, ShoppingCart, Users, Package, FolderTree, Warehouse, Truck, Phone,
  Wallet, Receipt, TrendingUp, BarChart3, ShieldCheck, Plug, ScrollText, Settings, Bell, Boxes,
  Inbox, ArrowRightLeft, History, MessageSquare, UserPlus, ChevronDown,
  ClipboardCheck, Send, Coins, GitBranch, Truck as TruckIcon, CreditCard,
} from "lucide-react";
import { ShieldCheck as Shield } from "lucide-react";

type NavItem = {
  label: string;
  route: RouteKey;
  icon: React.ComponentType<{ className?: string }>;
  permission?: string;
  matchPrefix?: string; // for highlighting the active sub-item
};

type NavSection = {
  title: string;
  items: NavItem[];
  collapsible?: boolean;
};

const SECTIONS: NavSection[] = [
  {
    title: "Overview",
    items: [
      { label: "Dashboard", route: "dashboard", icon: LayoutDashboard, permission: "dashboard:read" },
    ],
  },
  {
    title: "Sales",
    items: [
      { label: "Orders", route: "orders", icon: ShoppingCart, permission: "orders:read", matchPrefix: "orders" },
      { label: "Deliveries", route: "deliveries", icon: TruckIcon, permission: "deliveries:read", matchPrefix: "deliveries" },
      { label: "Customers", route: "customers", icon: Users, permission: "customers:read", matchPrefix: "customers" },
      { label: "Due Customers", route: "customers/dues", icon: Coins, permission: "customers:read" },
      { label: "Inbox", route: "inbox", icon: Inbox, permission: "conversations:read", matchPrefix: "inbox" },
      { label: "Payments", route: "payments", icon: Wallet, permission: "payments:read" },
      { label: "Returns", route: "returns", icon: Receipt, permission: "returns:read" },
      { label: "Leads", route: "leads", icon: UserPlus, permission: "leads:read" },
      { label: "Sales Pipeline", route: "pipeline/sales", icon: GitBranch, permission: "pipelines:read" },
      { label: "Lead Pipeline", route: "pipeline/leads", icon: GitBranch, permission: "leads:read" },
    ],
  },
  {
    title: "Catalog",
    items: [
      { label: "Products", route: "products", icon: Package, permission: "products:read", matchPrefix: "products" },
      { label: "Categories", route: "categories", icon: FolderTree, permission: "categories:read" },
      { label: "Inventory", route: "inventory", icon: Warehouse, permission: "inventory:read", matchPrefix: "inventory" },
      { label: "Stock Movements", route: "stock-movements", icon: History, permission: "inventory:read" },
      { label: "Stock Counts", route: "stock-counts", icon: ClipboardCheck, permission: "stock_counts:read" },
      { label: "Warehouses", route: "warehouses", icon: Boxes, permission: "warehouses:read" },
      { label: "Stock Transfers", route: "stock-transfers", icon: ArrowRightLeft, permission: "stock_transfers:read" },
      { label: "Purchases", route: "purchases", icon: Truck, permission: "purchases:read" },
      { label: "Suppliers", route: "suppliers", icon: Phone, permission: "suppliers:read" },
    ],
  },
  {
    title: "Finance",
    items: [
      { label: "Expenses", route: "expenses", icon: Receipt, permission: "expenses:read" },
      { label: "Cash Register", route: "cash-register", icon: Coins, permission: "reports:read" },
      { label: "Profit & Loss", route: "profit-loss", icon: TrendingUp, permission: "reports:read" },
      { label: "Billing & Wallet", route: "billing", icon: CreditCard, permission: "billing:read", matchPrefix: "billing" },
    ],
  },
  {
    title: "Reports",
    items: [
      { label: "Reports", route: "reports/sales", icon: BarChart3, permission: "reports:read", matchPrefix: "reports" },
    ],
  },
  {
    title: "System",
    items: [
      { label: "Users & Roles", route: "users", icon: ShieldCheck, permission: "users:read" },
      { label: "Integrations", route: "integrations", icon: Plug, permission: "integrations:read", matchPrefix: "integrations" },
      { label: "Couriers", route: "integrations/couriers", icon: TruckIcon, permission: "integrations:read" },
      { label: "Automation", route: "integrations/automation", icon: Send, permission: "automation:read" },
      { label: "Message Templates", route: "message-templates", icon: MessageSquare, permission: "message_templates:read" },
      { label: "Audit Logs", route: "audit", icon: ScrollText, permission: "audit_logs:read" },
      { label: "Notifications", route: "notifications", icon: Bell, permission: "notifications:read" },
      { label: "Settings", route: "settings", icon: Settings, permission: "settings:read" },
    ],
  },
];

function isActive(route: RouteKey, item: NavItem) {
  if (item.matchPrefix) return route.startsWith(item.matchPrefix);
  return route === item.route || route.startsWith(item.route + "/");
}

function NavListInner({ onNavigate }: { onNavigate?: () => void }) {
  const { route, navigate, user } = useCrmStore();
  const canSee = (item: NavItem) => !item.permission || user?.permissions?.includes(item.permission) || user?.role === "SUPER_ADMIN" || user?.role === "ADMIN";

  return (
    <div className="px-3 py-4 space-y-5">
      {SECTIONS.map((section) => {
        const visible = section.items.filter(canSee);
        if (!visible.length) return null;
        return (
          <div key={section.title}>
            <p className="px-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/70 mb-1.5">{section.title}</p>
            <div className="space-y-0.5">
              {visible.map((item) => {
                const active = isActive(route, item);
                const Icon = item.icon;
                return (
                  <button
                    key={item.route}
                    onClick={() => { navigate(item.route); onNavigate?.(); }}
                    className={cn(
                      "relative w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-all duration-150 group",
                      active
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground",
                    )}
                  >
                    {active && (
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-1 rounded-r-full bg-primary" />
                    )}
                    <Icon className={cn("h-[18px] w-[18px] shrink-0 transition-transform", active ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function Sidebar() {
  return (
    <aside className="hidden md:flex w-64 flex-col border-r border-border/60 bg-sidebar h-full">
      <div className="h-16 flex items-center gap-2.5 px-5 border-b border-border/60 shrink-0">
        <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-primary-foreground shadow-glow">
          <Shield className="h-[18px] w-[18px]" />
        </div>
        <div className="leading-none">
          <span className="font-bold text-[17px] tracking-tight gradient-text">Z-CRM</span>
          <p className="text-[10px] text-muted-foreground mt-0.5 font-medium">Omnichannel Suite</p>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto no-scrollbar">
        <NavListInner />
      </nav>
      <div className="border-t border-border/60 p-3 shrink-0">
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <Boxes className="h-3.5 w-3.5 text-primary/70" />
          <span className="font-medium">v2.0 · Production</span>
          <span className="ml-auto h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" title="System operational" />
        </div>
      </div>
    </aside>
  );
}

export function MobileNav() {
  const { sidebarOpen, setSidebarOpen } = useCrmStore();
  if (!sidebarOpen) return null;
  return (
    <div className="md:hidden fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
      <aside className="relative w-72 max-w-[80vw] bg-sidebar border-r border-border/60 flex flex-col">
        <div className="h-16 flex items-center justify-between px-5 border-b border-border/60 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-primary-foreground shadow-glow">
              <Shield className="h-[18px] w-[18px]" />
            </div>
            <div className="leading-none">
              <span className="font-bold text-[17px] tracking-tight gradient-text">Z-CRM</span>
              <p className="text-[10px] text-muted-foreground mt-0.5 font-medium">Omnichannel Suite</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto no-scrollbar">
          <NavListInner onNavigate={() => setSidebarOpen(false)} />
        </nav>
      </aside>
    </div>
  );
}

void ChevronDown;
