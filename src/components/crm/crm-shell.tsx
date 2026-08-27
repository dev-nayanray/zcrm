"use client";
import { useEffect } from "react";
import { useCrmStore } from "@/lib/store";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { DashboardView } from "./views/dashboard";
import { OrdersView } from "./views/orders";
import { OrderCreateView } from "./views/order-create";
import { OrderDetailView } from "./views/order-detail";
import { CustomersView } from "./views/customers";
import { CustomerDetailView } from "./views/customer-detail";
import { ProductsView } from "./views/products";
import { ProductDetailView } from "./views/product-detail";
import { CategoriesView } from "./views/categories";
import { SuppliersView } from "./views/suppliers";
import { InventoryView } from "./views/inventory";
import { PurchasesView } from "./views/purchases";
import { PaymentsView } from "./views/payments";
import { ExpensesView } from "./views/expenses";
import { ReturnsView } from "./views/returns";
import { ProfitLossView } from "./views/profit-loss";
import { ReportsView } from "./views/reports";
import { UsersView } from "./views/users";
import { IntegrationsView } from "./views/integrations";
import { WooCommerceIntegrationView } from "./views/integrations-woocommerce";
import { MetaIntegrationView } from "./views/integrations-meta";
import { WhatsAppIntegrationView } from "./views/integrations-whatsapp";
import { TelegramIntegrationView } from "./views/integrations-telegram";
import { BillingView, BillingCheckoutView, BillingWalletView, BillingAdminView } from "./views/billing";
import { ProfileView } from "./views/profile";
import { MobileBottomNav } from "./mobile-bottom-nav";
import { IntegrationLogsView } from "./views/integration-logs";
import { InboxView } from "./views/inbox";
import { ConversationDetailView } from "./views/conversation-detail";
import { InventoryDashboardView } from "./views/inventory-dashboard";
import { StockMovementsView } from "./views/stock-movements";
import { WarehousesView } from "./views/warehouses";
import { StockTransfersView } from "./views/stock-transfers";
import { LeadsView } from "./views/leads";
import { MessageTemplatesView } from "./views/message-templates";
import { AuditView } from "./views/audit";
import { SettingsView } from "./views/settings";
import { NotificationsView } from "./views/notifications";
import { DeliveriesView } from "./views/deliveries";
import { DeliveryDetailView } from "./views/delivery-detail";
import { CashRegisterView } from "./views/cash-register";
import { CustomerDuesView } from "./views/customer-dues";
import { StockCountsView } from "./views/stock-counts";
import { AutomationView } from "./views/automation";
import { CouriersView } from "./views/couriers";
import { LeadPipelineView } from "./views/lead-pipeline";
import { SalesPipelineView } from "./views/sales-pipeline";

export function CRMShell() {
  const { route, theme, setTheme } = useCrmStore();

  // Initialize theme on mount
  useEffect(() => {
    const saved = (typeof window !== "undefined" && localStorage.getItem("zcrm-theme")) as "light" | "dark" | null;
    const initial = saved || (typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") || "light";
    setTheme(initial);
  }, [setTheme]);

  return (
    <div className="flex h-screen overflow-hidden bg-background app-bg">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar />
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto w-full px-4 md:px-6 lg:px-8 py-5 md:py-7 pb-20 md:pb-7">
            <div key={route} className="fade-in-up">
              {renderRoute(route)}
            </div>
          </div>
        </main>
      </div>
      <MobileBottomNav />
    </div>
  );
}

function renderRoute(route: string) {
  switch (route) {
    case "dashboard": return <DashboardView />;
    case "orders": return <OrdersView />;
    case "orders/new": return <OrderCreateView />;
    case "orders/detail": return <OrderDetailView />;
    case "customers": return <CustomersView />;
    case "customers/detail": return <CustomerDetailView />;
    case "customers/dues": return <CustomerDuesView />;
    case "inbox": return <InboxView />;
    case "inbox/detail": return <ConversationDetailView />;
    case "products": return <ProductsView />;
    case "products/detail": return <ProductDetailView />;
    case "categories": return <CategoriesView />;
    case "suppliers": return <SuppliersView />;
    case "inventory": return <InventoryView />;
    case "inventory/dashboard": return <InventoryDashboardView />;
    case "stock-movements": return <StockMovementsView />;
    case "stock-counts": return <StockCountsView />;
    case "warehouses": return <WarehousesView />;
    case "stock-transfers": return <StockTransfersView />;
    case "leads": return <LeadsView />;
    case "pipeline/leads": return <LeadPipelineView />;
    case "pipeline/sales": return <SalesPipelineView />;
    case "message-templates": return <MessageTemplatesView />;
    case "purchases": return <PurchasesView />;
    case "payments": return <PaymentsView />;
    case "expenses": return <ExpensesView />;
    case "cash-register": return <CashRegisterView />;
    case "returns": return <ReturnsView />;
    case "deliveries": return <DeliveriesView />;
    case "deliveries/detail": return <DeliveryDetailView />;
    case "profit-loss": return <ProfitLossView />;
    case "reports/sales": return <ReportsView type="sales" />;
    case "reports/payments": return <ReportsView type="payments" />;
    case "reports/expenses": return <ReportsView type="expenses" />;
    case "reports/inventory": return <ReportsView type="inventory" />;
    case "reports/products": return <ReportsView type="products" />;
    case "reports/customers": return <ReportsView type="customers" />;
    case "reports/channels": return <ReportsView type="channels" />;
    case "reports/cash-flow": return <ReportsView type="cash-flow" />;
    case "reports/suppliers": return <ReportsView type="suppliers" />;
    case "reports/dues": return <ReportsView type="dues" />;
    case "users": return <UsersView />;
    case "integrations": return <IntegrationsView />;
    case "integrations/woocommerce": return <WooCommerceIntegrationView />;
    case "integrations/meta": return <MetaIntegrationView />;
    case "integrations/whatsapp": return <WhatsAppIntegrationView />;
    case "integrations/telegram": return <TelegramIntegrationView />;
    case "integrations/couriers": return <CouriersView />;
    case "integrations/automation": return <AutomationView />;
    case "integrations/logs": return <IntegrationLogsView />;
    case "billing": return <BillingView />;
    case "billing/checkout": return <BillingCheckoutView />;
    case "billing/wallet": return <BillingWalletView />;
    case "billing/admin": return <BillingAdminView />;
    case "profile": return <ProfileView />;
    case "audit": return <AuditView />;
    case "settings": return <SettingsView />;
    case "notifications": return <NotificationsView />;
    default: return <DashboardView />;
  }
}
