"use client";
import { create } from "zustand";

export type RouteKey =
  | "dashboard"
  | "orders" | "orders/new" | "orders/detail"
  | "customers" | "customers/detail"
  | "customers/dues"
  | "inbox" | "inbox/detail"
  | "products" | "products/detail"
  | "categories"
  | "inventory" | "inventory/dashboard"
  | "stock-movements" | "stock-counts"
  | "warehouses" | "stock-transfers"
  | "purchases"
  | "suppliers"
  | "payments"
  | "expenses"
  | "cash-register"
  | "returns"
  | "refunds"
  | "deliveries" | "deliveries/detail"
  | "profit-loss"
  | "pipeline/sales" | "pipeline/leads"
  | "reports/sales" | "reports/payments" | "reports/expenses" | "reports/inventory" | "reports/products" | "reports/customers" | "reports/channels" | "reports/cash-flow" | "reports/suppliers" | "reports/dues"
  | "users" | "roles"
  | "integrations" | "integrations/woocommerce" | "integrations/meta" | "integrations/whatsapp" | "integrations/telegram" | "integrations/logs" | "integrations/couriers" | "integrations/automation"
  | "billing" | "billing/checkout" | "billing/wallet" | "billing/admin"
  | "profile"
  | "leads"
  | "message-templates"
  | "audit"
  | "notifications"
  | "settings";

type State = {
  route: RouteKey;
  params: Record<string, string>; // e.g. { id: "abc" } for detail pages
  user: { id: string; name: string; email: string; role: string; permissions: string[] } | null;
  theme: "light" | "dark";
  sidebarOpen: boolean;
};

type Actions = {
  navigate: (route: RouteKey, params?: Record<string, string>) => void;
  setUser: (user: State["user"]) => void;
  setTheme: (theme: "light" | "dark") => void;
  toggleTheme: () => void;
  setSidebarOpen: (open: boolean) => void;
};

export const useCrmStore = create<State & Actions>((set) => ({
  route: "dashboard",
  params: {},
  user: null,
  theme: "light",
  sidebarOpen: false,
  navigate: (route, params = {}) => set({ route, params, sidebarOpen: false }),
  setUser: (user) => set({ user }),
  setTheme: (theme) => {
    set({ theme });
    if (typeof document !== "undefined") {
      document.documentElement.classList.toggle("dark", theme === "dark");
      try { localStorage.setItem("zcrm-theme", theme); } catch {}
    }
  },
  toggleTheme: () => {
    set((s) => {
      const theme = s.theme === "light" ? "dark" : "light";
      if (typeof document !== "undefined") {
        document.documentElement.classList.toggle("dark", theme === "dark");
        try { localStorage.setItem("zcrm-theme", theme); } catch {}
      }
      return { theme };
    });
  },
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
}));
