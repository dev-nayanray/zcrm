import type { MetadataRoute } from "next";

const SITE_URL = "https://z-crm.app";

// Static public routes that should be indexed.
const STATIC_ROUTES = [
  { path: "/", priority: 1, changeFrequency: "weekly" as const },
  { path: "/features", priority: 0.9, changeFrequency: "monthly" as const },
  { path: "/pricing", priority: 0.9, changeFrequency: "weekly" as const },
  { path: "/about", priority: 0.7, changeFrequency: "monthly" as const },
  { path: "/contact", priority: 0.7, changeFrequency: "monthly" as const },
  { path: "/faq", priority: 0.8, changeFrequency: "monthly" as const },
  { path: "/integrations", priority: 0.8, changeFrequency: "monthly" as const },
  // Product pages
  ...[
    "crm", "sales-management", "order-management", "customer-management",
    "inventory-management", "purchase-management", "supplier-management",
    "delivery-management", "payment-management", "finance-accounting",
    "reports-analytics", "lead-management", "sales-pipeline", "kanban",
    "automation", "notifications", "user-role-management", "audit-logs",
  ].map((slug) => ({ path: `/product/${slug}`, priority: 0.7, changeFrequency: "monthly" as const })),
  // Integration pages
  ...[
    "woocommerce", "whatsapp", "facebook", "messenger", "telegram",
    "courier", "bkash", "nagad", "payments",
  ].map((slug) => ({ path: `/integrations/${slug}`, priority: 0.7, changeFrequency: "monthly" as const })),
  // Use case pages
  ...[
    "ecommerce", "retail", "wholesale", "distribution", "service-business", "multi-warehouse",
  ].map((slug) => ({ path: `/use-cases/${slug}`, priority: 0.7, changeFrequency: "monthly" as const })),
  // Resource pages
  ...["docs", "help", "blog", "tutorials", "changelog", "support"].map((slug) =>
    ({ path: `/resources/${slug}`, priority: 0.6, changeFrequency: "weekly" as const }),
  ),
  // Legal pages
  ...["privacy", "terms", "refund", "cookies", "security", "data-protection"].map((slug) =>
    ({ path: `/legal/${slug}`, priority: 0.3, changeFrequency: "yearly" as const }),
  ),
];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return STATIC_ROUTES.map((route) => ({
    url: `${SITE_URL}${route.path}`,
    lastModified,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
}
