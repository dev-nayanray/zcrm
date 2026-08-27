// Centralized content for the Z-CRM public website.
//
// All marketing copy, feature lists, integration details, testimonials,
// pricing plans, FAQs, and footer links live here so the page files stay
// thin and the content is easy to update in one place.

export const SITE = {
  name: "Z-CRM",
  productName: "Z-CRM Omnichannel Suite",
  tagline: "Run your entire business from one place.",
  description:
    "Z-CRM is the complete omnichannel business management suite for Bangladesh businesses. Manage orders, customers, inventory, payments, profit & loss, WhatsApp, Facebook, WooCommerce & Telegram — all in one place.",
  url: "https://z-crm.app",
  email: "hello@z-crm.app",
  supportEmail: "support@z-crm.app",
  phone: "+880 1700-000000",
  address: "Gulshan-1, Dhaka 1212, Bangladesh",
  founded: 2024,
  currency: "BDT",
  currencySymbol: "৳",
};

// ─── Top-level navigation ───
export const NAV_LINKS = [
  { label: "Features", href: "/features" },
  { label: "Integrations", href: "/integrations" },
  { label: "Pricing", href: "/pricing" },
  { label: "Use Cases", href: "/use-cases/ecommerce" },
  { label: "Resources", href: "/resources/docs" },
  { label: "About", href: "/about" },
];

// ─── Business metrics for the trust bar ───
export const METRICS = [
  { value: "2,400+", label: "Businesses onboarded", sub: "Across Bangladesh" },
  { value: "৳48Cr+", label: "GMV processed", sub: "In the last 12 months" },
  { value: "1.2M+", label: "Orders managed", sub: "Online + offline" },
  { value: "99.95%", label: "Uptime", sub: "Last 90 days" },
];

// ─── Hero feature pills ───
export const HERO_PILLS = [
  "Ledger-based inventory",
  "WooCommerce sync",
  "WhatsApp + Meta inbox",
  "Role-based access",
  "Automation engine",
  "P&L reports",
  "bKash / Nagad",
  "Multi-warehouse",
];

// ─── Bento feature grid (Everything You Need section) ───
export const BENTO_FEATURES = [
  {
    icon: "ShoppingCart",
    title: "Unified Orders",
    description: "Website, WhatsApp, Facebook, Instagram, phone, and in-store orders flow into one queue with the same inventory and accounting.",
    tone: "emerald",
  },
  {
    icon: "Boxes",
    title: "Ledger Inventory",
    description: "Stock-movement ledger as the single source of truth. Reserved, available, and damaged buckets with full audit trail.",
    tone: "teal",
  },
  {
    icon: "TrendingUp",
    title: "P&L Engine",
    description: "Revenue − COGS − fulfillment costs − expenses − refunds = net profit. Historical cost snapshots keep profitability immutable.",
    tone: "cyan",
  },
  {
    icon: "MessagesSquare",
    title: "Omnichannel Inbox",
    description: "WhatsApp, Facebook Messenger, and Instagram DMs unified. Convert a conversation into an order in two clicks.",
    tone: "violet",
  },
  {
    icon: "Bot",
    title: "Telegram Bot",
    description: "20+ commands, group-based RBAC, inline keyboards, English + Bangla. Operate the CRM from your phone.",
    tone: "fuchsia",
  },
  {
    icon: "Truck",
    title: "Courier Sync",
    description: "Pathao, Steadfast, RedX — create deliveries, auto-ship, and convert reservations to sales on delivery.",
    tone: "amber",
  },
  {
    icon: "Wallet",
    title: "bKash / Nagad",
    description: "All Bangladesh payment methods. Cash register with daily closing. Wallet for subscriptions and payouts.",
    tone: "emerald",
  },
  {
    icon: "ShieldCheck",
    title: "Audit & Security",
    description: "Every mutation logged. HMAC-signed sessions, PBKDF2-600k passwords, 60+ granular permissions enforced server-side.",
    tone: "teal",
  },
];

// ─── Complete business workflow steps ───
export const WORKFLOW_STEPS = [
  {
    step: "01",
    title: "Source",
    description: "Create suppliers and purchase orders. Receive stock into any warehouse.",
    icon: "Factory",
  },
  {
    step: "02",
    title: "Stock",
    description: "Ledger-based inventory with reservations, transfers, and reconciliation.",
    icon: "Boxes",
  },
  {
    step: "03",
    title: "Sell",
    description: "Orders from WooCommerce, WhatsApp, Meta, or manual entry — one queue.",
    icon: "ShoppingCart",
  },
  {
    step: "04",
    title: "Deliver",
    description: "Create deliveries with Pathao, Steadfast, or RedX. Auto-ship on confirmation.",
    icon: "Truck",
  },
  {
    step: "05",
    title: "Collect",
    description: "Record payments via bKash, Nagad, cash, or card. Wallet credits advance payments.",
    icon: "Wallet",
  },
  {
    step: "06",
    title: "Analyze",
    description: "Real-time P&L, channel analytics, and 11 report types. Export to CSV.",
    icon: "BarChart3",
  },
];

// ─── CRM modules (showcase grid) ───
export const MODULES = [
  { name: "Orders", icon: "ShoppingCart", description: "Create, track, and fulfil orders across every channel.", href: "/product/order-management" },
  { name: "Customers", icon: "Users", description: "360° profile with orders, payments, conversations, and dues.", href: "/product/customer-management" },
  { name: "Inventory", icon: "Boxes", description: "Multi-warehouse stock with reservations and reconciliation.", href: "/product/inventory-management" },
  { name: "Products", icon: "Package", description: "Variants, barcodes, categories, and reorder alerts.", href: "/product/crm" },
  { name: "Purchases", icon: "ClipboardList", description: "Supplier purchase orders with receiving and returns.", href: "/product/purchase-management" },
  { name: "Suppliers", icon: "Factory", description: "Supplier dashboard with outstanding payable tracking.", href: "/product/supplier-management" },
  { name: "Deliveries", icon: "Truck", description: "Courier integration with status history and COD.", href: "/product/delivery-management" },
  { name: "Payments", icon: "Wallet", description: "bKash, Nagad, cash, card. Auto-recompute payment status.", href: "/product/payment-management" },
  { name: "Expenses", icon: "Receipt", description: "Categorized expenses with date filtering and CSV export.", href: "/product/finance-accounting" },
  { name: "Returns", icon: "Undo2", description: "Good and damaged returns. Linked refunds with audit trail.", href: "/product/order-management" },
  { name: "Leads", icon: "UserPlus", description: "Import from Meta Lead Ads. Convert to customers in one click.", href: "/product/lead-management" },
  { name: "Sales Pipeline", icon: "KanbanSquare", description: "7-stage kanban with drag-and-drop. Pipeline value tracking.", href: "/product/sales-pipeline" },
  { name: "Conversations", icon: "MessagesSquare", description: "Omnichannel inbox for WhatsApp, Messenger, Instagram.", href: "/product/crm" },
  { name: "Automation", icon: "Bot", description: "Event→rule→action engine. WhatsApp confirmations, alerts.", href: "/product/automation" },
  { name: "Reports", icon: "BarChart3", description: "11 report types with date filtering and CSV export.", href: "/product/reports-analytics" },
  { name: "Cash Register", icon: "Calculator", description: "Daily closing with opening + inflows − outflows = closing.", href: "/product/finance-accounting" },
  { name: "Stock Counts", icon: "ClipboardCheck", description: "Reconciliation with approval workflow and audit log.", href: "/product/inventory-management" },
  { name: "Audit Logs", icon: "ShieldCheck", description: "Immutable record of every business-critical action.", href: "/product/audit-logs" },
];

// ─── Integration cards ───
export const INTEGRATIONS = [
  {
    key: "woocommerce",
    name: "WooCommerce",
    icon: "ShoppingBag",
    category: "E-commerce",
    description: "Two-way sync of orders, products, and customers via REST API + HMAC-signed webhooks.",
    href: "/integrations/woocommerce",
    color: "#7f54b3",
  },
  {
    key: "whatsapp",
    name: "WhatsApp Business",
    icon: "MessageCircle",
    category: "Messaging",
    description: "Cloud API for inbound messages, outbound templates, and order-from-conversation.",
    href: "/integrations/whatsapp",
    color: "#25d366",
  },
  {
    key: "facebook",
    name: "Facebook Lead Ads",
    icon: "Facebook",
    category: "Marketing",
    description: "Auto-import leads with HMAC-verified webhooks. Dedup by phone, convert to customers.",
    href: "/integrations/facebook",
    color: "#1877f2",
  },
  {
    key: "messenger",
    name: "Messenger",
    icon: "MessageSquare",
    category: "Messaging",
    description: "Unified omnichannel inbox with Messenger conversations alongside WhatsApp and Instagram.",
    href: "/integrations/messenger",
    color: "#0084ff",
  },
  {
    key: "telegram",
    name: "Telegram Bot",
    icon: "Send",
    category: "Operations",
    description: "20+ commands, group-based RBAC, inline keyboards, English + Bangla i18n.",
    href: "/integrations/telegram",
    color: "#26a5e4",
  },
  {
    key: "courier",
    name: "Courier Integration",
    icon: "Truck",
    category: "Logistics",
    description: "Pathao, Steadfast, RedX — create deliveries, auto-ship, track, and convert on delivery.",
    href: "/integrations/courier",
    color: "#f59e0b",
  },
  {
    key: "bkash",
    name: "bKash",
    icon: "Smartphone",
    category: "Payments",
    description: "Record bKash payments with transaction references. Auto-recompute payment status.",
    href: "/integrations/bkash",
    color: "#e2136e",
  },
  {
    key: "nagad",
    name: "Nagad",
    icon: "Smartphone",
    category: "Payments",
    description: "Record Nagad payments. Cash register includes all Bangladesh payment methods.",
    href: "/integrations/nagad",
    color: "#ec1c24",
  },
  {
    key: "payments",
    name: "Payment Gateways",
    icon: "CreditCard",
    category: "Payments",
    description: "All Bangladesh payment methods. Wallet for subscriptions, deposits, and payouts.",
    href: "/integrations/payments",
    color: "#10b981",
  },
];

// ─── Use cases ───
export const USE_CASES = [
  {
    key: "ecommerce",
    name: "E-commerce",
    icon: "ShoppingBag",
    tagline: "Sync WooCommerce, manage orders across channels",
    description: "For online stores running WooCommerce, Facebook, WhatsApp, and Instagram. Sync inventory, automate confirmations, and reconcile payments.",
    href: "/use-cases/ecommerce",
    stats: [
      { value: "4+", label: "Sales channels" },
      { value: "Auto", label: "Order confirmations" },
      { value: "Real-time", label: "Stock sync" },
    ],
  },
  {
    key: "retail",
    name: "Retail",
    icon: "Store",
    tagline: "POS-style order creation, cash register, low-stock alerts",
    description: "For brick-and-mortar stores. Fast order creation, cash register with daily closing, barcode-ready products, and reorder alerts.",
    href: "/use-cases/retail",
    stats: [
      { value: "<30s", label: "Order creation" },
      { value: "Daily", label: "Cash closing" },
      { value: "Auto", label: "Reorder alerts" },
    ],
  },
  {
    key: "wholesale",
    name: "Wholesale",
    icon: "Package",
    tagline: "Bulk orders, credit limits, supplier management",
    description: "For B2B wholesalers. Customer credit limits, advance payments, bulk order processing, and supplier purchase orders.",
    href: "/use-cases/wholesale",
    stats: [
      { value: "Bulk", label: "Order entry" },
      { value: "Credit", label: "Limits & advances" },
      { value: "Full", label: "Supplier workflow" },
    ],
  },
  {
    key: "distribution",
    name: "Distribution",
    icon: "Truck",
    tagline: "Multi-warehouse, courier sync, route optimization",
    description: "For distributors with multiple warehouses. Stock transfers, courier integration, and delivery tracking across regions.",
    href: "/use-cases/distribution",
    stats: [
      { value: "Multi", label: "Warehouses" },
      { value: "3", label: "Couriers" },
      { value: "Live", label: "Delivery tracking" },
    ],
  },
  {
    key: "service",
    name: "Service Business",
    icon: "Wrench",
    tagline: "Appointments, leads, sales pipeline, invoices",
    description: "For service businesses. Lead capture from Meta Lead Ads, sales pipeline kanban, appointment tracking, and invoicing.",
    href: "/use-cases/service-business",
    stats: [
      { value: "Auto", label: "Lead import" },
      { value: "7-stage", label: "Pipeline" },
      { value: "Full", label: "Invoicing" },
    ],
  },
  {
    key: "multi-warehouse",
    name: "Multi-Warehouse",
    icon: "Warehouse",
    tagline: "Stock transfers, per-warehouse stock, reconciliation",
    description: "For businesses with multiple warehouses. Per-warehouse stock levels, transfer approvals, and stock count reconciliation.",
    href: "/use-cases/multi-warehouse",
    stats: [
      { value: "Per-WH", label: "Stock tracking" },
      { value: "Approval", label: "Transfer workflow" },
      { value: "Full", label: "Reconciliation" },
    ],
  },
];

// ─── Competitor comparison ───
export const COMPARISON = [
  { feature: "Omnichannel orders (Website + WhatsApp + Facebook + Instagram)", zcrm: true, others: "partial" },
  { feature: "Stock movement ledger with reservations", zcrm: true, others: false },
  { feature: "Historical COGS snapshots (immutable profitability)", zcrm: true, others: false },
  { feature: "Telegram bot with group-based RBAC", zcrm: true, others: false },
  { feature: "Bangladesh payments (bKash, Nagad, cash, card)", zcrm: true, others: "partial" },
  { feature: "Courier integration (Pathao, Steadfast, RedX)", zcrm: true, others: false },
  { feature: "Cash register with daily closing", zcrm: true, others: false },
  { feature: "Meta Lead Ads auto-import with HMAC verification", zcrm: true, others: false },
  { feature: "Automation engine (WhatsApp confirmations, alerts)", zcrm: true, others: "partial" },
  { feature: "Multi-warehouse with transfer approval workflow", zcrm: true, others: false },
  { feature: "Stock count reconciliation with approval", zcrm: true, others: false },
  { feature: "Immutable audit logs (every mutation logged)", zcrm: true, others: "partial" },
  { feature: "PBKDF2-600k password hashing, HMAC sessions", zcrm: true, others: false },
  { feature: "60+ granular permissions, 6 system roles", zcrm: true, others: "partial" },
  { feature: "English + Bangla support (Telegram bot + UI)", zcrm: true, others: false },
  { feature: "Starting at ৳500/week (no annual contract required)", zcrm: true, others: false },
];

// ─── Pricing plans ───
export const PRICING = [
  {
    key: "WEEKLY",
    name: "Weekly",
    price: 500,
    period: "/week",
    periodLabel: "per week",
    description: "Perfect for small businesses getting started.",
    highlight: false,
    cta: "Start Weekly",
    features: [
      "Up to 2 users",
      "All 18 modules",
      "WooCommerce + WhatsApp + Meta",
      "1 warehouse",
      "1,000 orders/month",
      "Email support",
      "7-day free trial",
    ],
  },
  {
    key: "MONTHLY",
    name: "Monthly",
    price: 1800,
    period: "/month",
    periodLabel: "per month",
    description: "For growing businesses that need more headroom.",
    highlight: true,
    cta: "Start Monthly",
    badge: "Most popular",
    features: [
      "Up to 10 users",
      "All 18 modules",
      "WooCommerce + WhatsApp + Meta + Telegram",
      "3 warehouses",
      "10,000 orders/month",
      "Automation engine",
      "Priority email + chat support",
      "7-day free trial",
    ],
  },
  {
    key: "YEARLY",
    name: "Yearly",
    price: 18000,
    period: "/year",
    periodLabel: "per year (2 months free)",
    description: "Best value for established businesses.",
    highlight: false,
    cta: "Start Yearly",
    features: [
      "Up to 50 users",
      "All 18 modules",
      "All integrations",
      "Unlimited warehouses",
      "100,000 orders/month",
      "Automation engine",
      "Priority support + onboarding",
      "7-day free trial",
    ],
  },
  {
    key: "LIFETIME",
    name: "Lifetime",
    price: 50000,
    period: "one-time",
    periodLabel: "one-time payment",
    description: "Pay once, use forever. No recurring fees.",
    highlight: false,
    cta: "Buy Lifetime",
    features: [
      "Unlimited users",
      "All 18 modules",
      "All integrations",
      "Unlimited warehouses",
      "Unlimited orders",
      "Automation engine",
      "Lifetime updates",
      "Dedicated support",
    ],
  },
];

// ─── Testimonials ───
export const TESTIMONIALS = [
  {
    name: "Rahim Ahmed",
    role: "Founder",
    company: "Dhaka Gadgets",
    location: "Dhaka",
    quote: "We switched from spreadsheets to Z-CRM and cut our order processing time by 70%. The WhatsApp inbox alone saves us 3 hours a day.",
    rating: 5,
    metric: "70% faster orders",
  },
  {
    name: "Sadia Islam",
    role: "Operations Manager",
    company: "Chittagong Fashion",
    location: "Chittagong",
    quote: "The multi-warehouse support is exactly what we needed. Stock transfers with approval workflow means we never lose track of inventory.",
    rating: 5,
    metric: "3 warehouses synced",
  },
  {
    name: "Tanvir Rahman",
    role: "CEO",
    company: "Sylhet Distribution",
    location: "Sylhet",
    quote: "P&L is finally accurate. The COGS snapshots mean our historical profitability never changes when supplier prices update. Game-changer.",
    rating: 5,
    metric: "Accurate P&L",
  },
  {
    name: "Fatima Begum",
    role: "Owner",
    company: "Khulna Crafts",
    location: "Khulna",
    quote: "Lead ads from Facebook automatically import into the CRM. We just convert them to customers and start the conversation. Zero manual entry.",
    rating: 5,
    metric: "Zero manual lead entry",
  },
  {
    name: "Karim Hassan",
    role: "Managing Director",
    company: "Rajshahi Wholesale",
    location: "Rajshahi",
    quote: "The Telegram bot lets my sales team check stock and create orders from their phones. They never have to open a laptop.",
    rating: 5,
    metric: "Mobile-first ops",
  },
  {
    name: "Ayesha Siddique",
    role: "Accounts Lead",
    company: "Barishal Traders",
    location: "Barishal",
    quote: "The cash register with daily closing means our books are always reconciled. The audit log gives me complete confidence in the numbers.",
    rating: 5,
    metric: "Books always reconciled",
  },
];

// ─── FAQ (landing page + FAQ page) ───
export const FAQS = [
  {
    q: "What is Z-CRM?",
    a: "Z-CRM is a complete omnichannel business management suite that unifies orders, customers, inventory, payments, profit & loss, WhatsApp, Facebook, WooCommerce, and Telegram into one system. It is designed for Bangladesh businesses with native support for bKash, Nagad, cash, and local courier integrations.",
  },
  {
    q: "How much does Z-CRM cost?",
    a: "Z-CRM starts at only ৳500/week. We offer flexible pricing: ৳500/week, ৳1,800/month, ৳18,000/year, or a one-time lifetime payment of ৳50,000. The weekly plan is perfect for small businesses and includes a 7-day free trial.",
  },
  {
    q: "Can I pay weekly?",
    a: "Yes. The Weekly plan at ৳500/week is designed for small businesses that prefer pay-as-you-go pricing with no annual contract. You can upgrade, downgrade, or cancel at any time.",
  },
  {
    q: "Does Z-CRM support WooCommerce?",
    a: "Yes. Z-CRM syncs orders, products, and customers from WooCommerce via REST API and HMAC-signed webhooks. It remains independent from WordPress and runs on its own infrastructure, so a WordPress outage doesn't take down your CRM.",
  },
  {
    q: "Does Z-CRM support WhatsApp?",
    a: "Yes. Z-CRM integrates with the WhatsApp Business Cloud API for inbound messages, outbound template messages, and order-from-conversation. The omnichannel inbox unifies WhatsApp, Facebook Messenger, and Instagram DMs.",
  },
  {
    q: "How does the Telegram bot work?",
    a: "The Telegram bot supports 20+ commands (/orders, /customers, /inventory, /payments, /leads, /reports, /cash, /deliveries, /returns, /purchases, /suppliers, /expenses, /products, /stockcount, /movements, /warehouses, /transfers, /inbox, /notifications, /pipeline). Each Telegram group is mapped to a CRM role, so members only see data their role permits. Sensitive actions require confirmation. Both English and Bangla are supported.",
  },
  {
    q: "Is my financial data accurate?",
    a: "Yes. Z-CRM uses Prisma Decimal for all money calculations — no floating-point errors. Order items store historical cost snapshots so historical profitability never changes when prices are updated. The P&L engine uses the same formula as every report, so the dashboard, P&L, and per-order profit always agree.",
  },
  {
    q: "Can I customize roles?",
    a: "Yes. Z-CRM ships with 6 system roles (SUPER_ADMIN, ADMIN, MANAGER, SALES, INVENTORY, ACCOUNTANT) with 60+ granular permissions. You can create custom roles and assign any subset of permissions. All permissions are enforced server-side on every API route.",
  },
  {
    q: "Which payment methods does Z-CRM support?",
    a: "Cash, bKash, Nagad, Bank, Card, Wallet, and Other. The cash register filters by CASH for daily closing. All payment methods are tracked with transaction references for reconciliation.",
  },
  {
    q: "Can I use Z-CRM for offline orders?",
    a: "Absolutely. Z-CRM has a fast order creation screen for offline orders. Online and offline orders share the same inventory, accounting, and customer database.",
  },
  {
    q: "Is there a free trial?",
    a: "Yes. Every plan starts with a 7-day free trial. No credit card required. You can explore all features with your own data before committing.",
  },
  {
    q: "How do I get support?",
    a: "All plans include email support. The Monthly plan adds priority email + chat support. The Yearly and Lifetime plans include priority support + onboarding. You can also reach us at support@z-crm.app.",
  },
];

// ─── Product pages content ───
export const PRODUCT_PAGES = [
  {
    slug: "crm",
    name: "CRM",
    icon: "Users",
    tagline: "One customer database across every channel",
    description:
      "The Z-CRM customer module is the single source of truth for every customer. Orders, payments, conversations, leads, returns, and credit limits — all in one 360° profile.",
    features: [
      { title: "360° Customer Profile", description: "Orders, payments, conversations, leads, returns, and credit limits in one view." },
      { title: "Cross-Channel Dedup", description: "Phone normalization unifies customers from Meta, WhatsApp, WooCommerce, and manual entry." },
      { title: "Customer Dues", description: "Per-customer outstanding balance with advance payment tracking and credit limits." },
      { title: "Lifetime Value", description: "Total sales, total paid, total refunds, and net value per customer." },
      { title: "Conversations", description: "Every WhatsApp, Messenger, and Instagram conversation linked to the customer." },
      { title: "Lead Origin", description: "See which Meta lead gen form the customer came from, with full attribution." },
    ],
    benefits: [
      "Stop creating duplicate customers across channels",
      "See every customer touchpoint in one place",
      "Track outstanding balances and credit limits",
      "Convert leads to customers in one click",
    ],
  },
  {
    slug: "sales-management",
    name: "Sales Management",
    icon: "TrendingUp",
    tagline: "From lead to closed deal — one workflow",
    description:
      "Manage the entire sales lifecycle from lead capture to closed deal. Pipeline kanban, lead follow-ups, conversion tracking, and sales analytics — all powered by the same customer database.",
    features: [
      { title: "Lead Capture", description: "Auto-import from Meta Lead Ads. Manual lead creation with status workflow." },
      { title: "Lead Pipeline", description: "Kanban view with NEW, CONTACTED, QUALIFIED, FOLLOW_UP, CONVERTED, LOST stages." },
      { title: "Sales Pipeline", description: "7-stage sales pipeline with drag-and-drop and pipeline value tracking." },
      { title: "Follow-ups", description: "Schedule and track follow-ups with assignment and notes." },
      { title: "Lead Conversion", description: "Convert a lead to a customer in one click, preserving attribution." },
      { title: "Sales Analytics", description: "Conversion rates, pipeline velocity, and per-salesperson performance." },
    ],
    benefits: [
      "Never lose a lead in someone's notebook",
      "See your pipeline value at a glance",
      "Track conversion rates by source",
      "Assign leads and follow-ups to specific salespeople",
    ],
  },
  {
    slug: "order-management",
    name: "Order Management",
    icon: "ShoppingCart",
    tagline: "Every order, every channel, one queue",
    description:
      "Orders from WooCommerce, WhatsApp, Facebook, Instagram, phone, and in-store all flow into one unified queue. Stock reservation, status workflow, and audit trail — built in.",
    features: [
      { title: "Unified Order Queue", description: "All channels in one list with filter, search, sort, and pagination." },
      { title: "Stock Reservation", description: "Reserve stock at order creation; convert to sale on delivery." },
      { title: "Status Workflow", description: "PENDING → CONFIRMED → PROCESSING → SHIPPED → DELIVERED with validation." },
      { title: "Order Timeline", description: "Status history, payments, refunds, and delivery events in one vertical timeline." },
      { title: "Order from Conversation", description: "Create an order from a WhatsApp/Messenger conversation in two clicks." },
      { title: "Returns & Refunds", description: "Good and damaged returns with linked refunds and stock adjustments." },
    ],
    benefits: [
      "Stop switching between 5 apps to manage orders",
      "Reserve stock the moment an order is placed",
      "See the full history of every order",
      "Handle returns without losing track of inventory",
    ],
  },
  {
    slug: "customer-management",
    name: "Customer Management",
    icon: "Users",
    tagline: "Know every customer, across every channel",
    description:
      "A unified customer database with cross-channel deduplication, 360° profiles, dues tracking, credit limits, and lifetime value. The foundation of every other module.",
    features: [
      { title: "Cross-Channel Dedup", description: "Phone normalization unifies customers from Meta, WhatsApp, WooCommerce, and manual entry." },
      { title: "360° Profile", description: "Orders, payments, conversations, leads, returns, and credit in one view." },
      { title: "Customer Dues", description: "Per-customer outstanding balance with date filtering and CSV export." },
      { title: "Credit Limits", description: "Set credit limits per customer; track advances and credits." },
      { title: "Lifetime Value", description: "Total sales, total paid, total refunds, and net value per customer." },
      { title: "Customer Segments", description: "Filter by location, order count, total sales, outstanding balance." },
    ],
    benefits: [
      "One customer record across every channel",
      "See who owes you and how much",
      "Set credit limits to manage risk",
      "Identify your best customers by lifetime value",
    ],
  },
  {
    slug: "inventory-management",
    name: "Inventory Management",
    icon: "Boxes",
    tagline: "Ledger-based stock — the single source of truth",
    description:
      "Every stock change is recorded as a movement in an immutable ledger. Reserved, available, and damaged buckets. Multi-warehouse, transfers, and reconciliation — built in.",
    features: [
      { title: "Stock Movement Ledger", description: "PURCHASE, SALE, RETURN, DAMAGE, ADJUSTMENT, TRANSFER, RESERVATION, RELEASE — all logged." },
      { title: "Reserved vs Available", description: "Reserve stock for pending orders; available = physical − reserved." },
      { title: "Multi-Warehouse", description: "Per-warehouse stock with transfer approval workflow." },
      { title: "Stock Counts", description: "Reconciliation with system vs counted vs difference. Approval workflow." },
      { title: "Low-Stock Alerts", description: "Automatic notifications with suggested reorder quantities." },
      { title: "Stock Valuation", description: "Cost and retail value across all inventory with damaged bucket tracking." },
    ],
    benefits: [
      "Never oversell — reserved stock is locked",
      "Track every unit — full audit trail",
      "Run multi-warehouse with proper transfers",
      "Reconcile stock with approval workflow",
    ],
  },
  {
    slug: "purchase-management",
    name: "Purchase Management",
    icon: "ClipboardList",
    tagline: "From supplier to warehouse — tracked end-to-end",
    description:
      "Create purchase orders, receive stock into any warehouse, track payments, and handle returns. The full procure-to-pay workflow with audit trail.",
    features: [
      { title: "Purchase Orders", description: "Create POs with line items, shipping, discounts, and payment tracking." },
      { title: "Stock Receiving", description: "Receive stock into inventory with PURCHASE movements in the ledger." },
      { title: "Payment Tracking", description: "Track paid vs due per purchase. Auto-recompute payment status." },
      { title: "Purchase Returns", description: "Return defective stock to suppliers; reduce due with supplier credit." },
      { title: "Supplier Dashboard", description: "Per-supplier totals: purchases, paid, outstanding, payment history." },
      { title: "Purchase Reports", description: "Spending by supplier, by product, by period. CSV export." },
    ],
    benefits: [
      "Know exactly what you owe each supplier",
      "Receive stock without manual ledger entries",
      "Track purchase returns with supplier credits",
      "See spending trends by supplier and product",
    ],
  },
  {
    slug: "supplier-management",
    name: "Supplier Management",
    icon: "Factory",
    tagline: "Every supplier, every purchase, every payment",
    description:
      "A supplier database with full purchase history, outstanding payables, payment tracking, and returns. The vendor side of your procure-to-pay workflow.",
    features: [
      { title: "Supplier Database", description: "Contact info, company, notes. Linked to every purchase and payment." },
      { title: "Supplier Dashboard", description: "Total purchases, total paid, outstanding payable, payment count." },
      { title: "Payment Tracking", description: "Record supplier payments; reduce purchase due automatically." },
      { title: "Purchase History", description: "Every PO with the supplier, with status and payment state." },
      { title: "Supplier Payments Report", description: "All payments to a supplier with date filtering and CSV export." },
      { title: "Outstanding Payable", description: "Real-time total of what you owe across all suppliers." },
    ],
    benefits: [
      "See who you owe and how much — instantly",
      "Track every supplier payment with audit trail",
      "Reconcile supplier statements in seconds",
      "Never miss an early-payment discount",
    ],
  },
  {
    slug: "delivery-management",
    name: "Delivery Management",
    icon: "Truck",
    tagline: "Pathao, Steadfast, RedX — all in one place",
    description:
      "Create deliveries with any Bangladesh courier, auto-ship on order confirmation, track status, and convert reservations to sales on delivery. Full status history per delivery.",
    features: [
      { title: "Courier Integration", description: "Pathao, Steadfast, RedX — abstracted behind a single API." },
      { title: "Auto-Ship", description: "Optionally auto-create and ship the delivery when the order is confirmed." },
      { title: "Status Tracking", description: "PENDING → PICKED_UP → SHIPPED → OUT_FOR_DELIVERY → DELIVERED with history." },
      { title: "COD Tracking", description: "Cash-on-delivery amount per delivery. Reconcile with courier returns." },
      { title: "Delivery Dashboard", description: "Counts by status, courier performance, daily delivery trends." },
      { title: "Order Sync", description: "Delivery status changes sync back to the order (SHIPPED, DELIVERED)." },
    ],
    benefits: [
      "One screen for all your couriers",
      "Auto-ship saves 5 minutes per order",
      "Track every delivery with full history",
      "Reconcile COD returns easily",
    ],
  },
  {
    slug: "payment-management",
    name: "Payment Management",
    icon: "Wallet",
    tagline: "bKash, Nagad, cash, card — all tracked",
    description:
      "Record every customer payment with method, amount, and transaction reference. Auto-recompute payment status. Cash register with daily closing. Wallet for credits.",
    features: [
      { title: "All Payment Methods", description: "CASH, BKASH, NAGAD, BANK, CARD, WALLET, OTHER — validated at the API." },
      { title: "Auto Payment Status", description: "UNPAID → PARTIAL → PAID → REFUNDED, recomputed from payment records." },
      { title: "Overpayment Prevention", description: "Reject payments that exceed the order total." },
      { title: "Cash Register", description: "Opening + cash inflows − refunds − expenses = closing. Daily snapshots." },
      { title: "Customer Credit", description: "Advance payments, credit limits, and per-customer balance." },
      { title: "Payment Reports", description: "By method, by date, by customer. CSV export for reconciliation." },
    ],
    benefits: [
      "Never record the wrong payment method",
      "See who has paid and who hasn't — instantly",
      "Close the cash register daily with one click",
      "Track customer advances and credits",
    ],
  },
  {
    slug: "finance-accounting",
    name: "Finance & Accounting",
    icon: "Calculator",
    tagline: "Real P&L — not a guess",
    description:
      "The Z-CRM accounting engine is the single source of truth for financial calculations. Revenue − COGS − fulfillment costs − expenses − refunds = net profit. Historical cost snapshots keep profitability immutable.",
    features: [
      { title: "P&L Engine", description: "Revenue, COGS, fulfillment costs, operating expenses, refunds, net profit. One formula, used everywhere." },
      { title: "Historical COGS", description: "OrderItem.unitCost is a snapshot — profitability never changes when prices update." },
      { title: "Cash Register", description: "Daily closing with opening, inflows, outflows. Persisted snapshots." },
      { title: "Expense Tracking", description: "Categorized expenses with payment method, date, and reference." },
      { title: "Refund Tracking", description: "Refunds linked to returns and orders; auto-recompute payment status." },
      { title: "Chart of Accounts", description: "Expense categories map to a simple chart of accounts." },
    ],
    benefits: [
      "Trust your P&L — it's the same formula everywhere",
      "Historical profitability is immutable",
      "Close the books daily, not monthly",
      "Track every refund with full audit trail",
    ],
  },
  {
    slug: "reports-analytics",
    name: "Reports & Analytics",
    icon: "BarChart3",
    tagline: "11 report types, all with CSV export",
    description:
      "From sales by channel to supplier payments, every report uses the same accounting engine. Date filtering, presets, and CSV export — built in.",
    features: [
      { title: "Sales Report", description: "Revenue, orders, average order value, by date and channel." },
      { title: "Payments Report", description: "By method, by date, by customer. Reconciliation-ready." },
      { title: "Expenses Report", description: "By category, by date, by payment method." },
      { title: "Inventory Report", description: "Stock valuation, low-stock, movements, by product." },
      { title: "Products Report", description: "Top products by revenue, profit, and quantity." },
      { title: "Customers Report", description: "Top customers, outstanding dues, lifetime value." },
      { title: "Channels Report", description: "Revenue and orders by sales channel." },
      { title: "Cash Flow Report", description: "Daily cash in and out with running balance." },
      { title: "Suppliers Report", description: "Purchases, payments, outstanding by supplier." },
      { title: "Dues Report", description: "Customer outstanding by age, by amount, by status." },
      { title: "P&L Report", description: "Full profit & loss with date range and CSV export." },
    ],
    benefits: [
      "One formula — every report agrees",
      "Filter by date, customer, channel, supplier",
      "Export to CSV for accounting or spreadsheets",
      "Spot trends with charts and top-N lists",
    ],
  },
  {
    slug: "lead-management",
    name: "Lead Management",
    icon: "UserPlus",
    tagline: "From Facebook Lead Ad to customer — automatically",
    description:
      "Auto-import leads from Meta Lead Ads with HMAC-verified webhooks. Dedup by phone. Convert to customers in one click. Pipeline kanban with follow-ups.",
    features: [
      { title: "Meta Lead Import", description: "HMAC-verified webhooks auto-import leads from Facebook Lead Ads." },
      { title: "Lead Pipeline", description: "NEW, CONTACTED, QUALIFIED, FOLLOW_UP, CONVERTED, LOST — kanban with DnD." },
      { title: "Lead Follow-ups", description: "Schedule follow-ups with assignment, due date, and notes." },
      { title: "Lead Conversion", description: "Convert a lead to a customer in one click; preserve attribution." },
      { title: "Phone Dedup", description: "Normalize phones across Meta (+E.164), WhatsApp, and manual entry." },
      { title: "Lead Analytics", description: "Conversion rate by source, by campaign, by salesperson." },
    ],
    benefits: [
      "Never manually enter a lead from Facebook again",
      "See your lead pipeline at a glance",
      "Follow up on time, every time",
      "Track which campaigns convert",
    ],
  },
  {
    slug: "sales-pipeline",
    name: "Sales Pipeline",
    icon: "KanbanSquare",
    tagline: "7-stage kanban with drag-and-drop",
    description:
      "Visualize your sales pipeline as a kanban board. Drag deals between stages. Track pipeline value. Assign deals to salespeople. All powered by the customer database.",
    features: [
      { title: "7-Stage Kanban", description: "NEW → CONTACTED → QUALIFIED → NEGOTIATION → ORDER_CREATED → WON → LOST." },
      { title: "Drag & Drop", description: "Move deals between stages with drag-and-drop. Status updates sync." },
      { title: "Pipeline Value", description: "Total value of open deals, by stage and by salesperson." },
      { title: "Per-Deal Notes", description: "Notes per pipeline entry with timestamps and assignment." },
      { title: "Assignment", description: "Assign deals to salespeople. Filter by assignee." },
      { title: "List ↔ Kanban", description: "Switch between list and kanban views. Same data, two presentations." },
    ],
    benefits: [
      "See your pipeline value at a glance",
      "Drag deals to update status — no forms",
      "Assign deals to the right salesperson",
      "Forecast revenue from open deals",
    ],
  },
  {
    slug: "kanban",
    name: "Kanban Boards",
    icon: "LayoutDashboard",
    tagline: "Visual workflows for orders, leads, and pipeline",
    description:
      "Drag-and-drop kanban boards for orders, leads, and the sales pipeline. Same data as the list view, just visual. Status updates enforce the workflow.",
    features: [
      { title: "Orders Kanban", description: "PENDING, CONFIRMED, PROCESSING, SHIPPED, DELIVERED, CANCELLED, RETURNED, REFUNDED." },
      { title: "Leads Kanban", description: "NEW, CONTACTED, QUALIFIED, FOLLOW_UP, CONVERTED, LOST." },
      { title: "Sales Pipeline Kanban", description: "7 stages from NEW to WON with pipeline value." },
      { title: "Drag & Drop", description: "Pointer-sensor drag with visual overlay. Touch-friendly." },
      { title: "Status Validation", description: "Backend rejects invalid transitions; Kanban can't bypass the workflow." },
      { title: "List ↔ Kanban Toggle", description: "Switch views with one click. Same data, same filters." },
    ],
    benefits: [
      "See status at a glance — no lists to scroll",
      "Update status by dragging — no forms",
      "Workflow enforced — no invalid transitions",
      "Touch-friendly for tablet use",
    ],
  },
  {
    slug: "automation",
    name: "Automation Engine",
    icon: "Bot",
    tagline: "Event → Rule → Action — fire-and-forget",
    description:
      "Define rules that fire on business events. Send WhatsApp confirmations, route alerts to Telegram, assign salespeople, create notifications. Non-blocking — never slows your transaction.",
    features: [
      { title: "Event Triggers", description: "ORDER_CREATED, ORDER_SHIPPED, ORDER_DELIVERED, ORDER_CANCELLED, PAYMENT_RECEIVED, LOW_STOCK, NEW_LEAD." },
      { title: "Actions", description: "SEND_WHATSAPP_TEMPLATE, CREATE_NOTIFICATION, ASSIGN_SALES_USER, CONVERT_RESERVATION." },
      { title: "Execution Log", description: "Every rule execution logged with status, result, and error." },
      { title: "Non-Blocking", description: "Triggers fire AFTER transaction commit. Never blocks the main operation." },
      { title: "Rule Toggle", description: "Enable/disable rules without deleting. Test before committing." },
      { title: "WhatsApp Templates", description: "Pre-approved templates with {{variable}} substitution." },
    ],
    benefits: [
      "Auto-send order confirmations on WhatsApp",
      "Route low-stock alerts to the warehouse Telegram group",
      "Auto-assign new leads to the right salesperson",
      "Build custom workflows without code",
    ],
  },
  {
    slug: "notifications",
    name: "Notifications",
    icon: "Bell",
    tagline: "In-app + Telegram — never miss an event",
    description:
      "In-app notifications for low stock, sync failures, and business events. Route to Telegram groups by event type. Mark as read, mark all as read, or delete.",
    features: [
      { title: "In-App Notifications", description: "Low stock, out of stock, sync failures, business events." },
      { title: "Telegram Routing", description: "Route notifications to specific Telegram groups by event type." },
      { title: "Per-User Scoping", description: "Each user sees their own notifications + broadcasts." },
      { title: "Mark Read / Delete", description: "Mark individual or all as read. Delete with scoping." },
      { title: "Notification Center", description: "Bell icon with unread count badge in the topbar." },
      { title: "Link to Detail", description: "Each notification links to the relevant detail page." },
    ],
    benefits: [
      "Catch stock-outs before they happen",
      "Get alerts in your Telegram group, not just in-app",
      "Each user sees only their own notifications",
      "Click through to the detail page in one click",
    ],
  },
  {
    slug: "user-role-management",
    name: "User & Role Management",
    icon: "UserCog",
    tagline: "60+ permissions, 6 system roles, full audit",
    description:
      "Granular RBAC with 60+ permissions across 6 system roles. Create custom roles. Assign any subset of permissions. Every mutation enforced server-side. Last-super-admin guard prevents lockout.",
    features: [
      { title: "6 System Roles", description: "SUPER_ADMIN, ADMIN, MANAGER, SALES, INVENTORY, ACCOUNTANT." },
      { title: "60+ Permissions", description: "Granular per-resource permissions (read, create, update, delete, approve, etc.)." },
      { title: "Custom Roles", description: "Create custom roles with any subset of permissions. Validate against canonical list." },
      { title: "Server-Side Enforcement", description: "Every API route checks permissions. No client-side bypass possible." },
      { title: "Last-Super-Admin Guard", description: "Prevents demoting or deleting the last super-admin (no lockout)." },
      { title: "User Audit Log", description: "USER_CREATE, USER_UPDATE, PERMISSION_CHANGE for every role change." },
    ],
    benefits: [
      "Give salespeople access to orders, not to expenses",
      "Let inventory team manage stock, not payments",
      "Create custom roles for unique org structures",
      "Sleep well — every mutation is enforced server-side",
    ],
  },
  {
    slug: "audit-logs",
    name: "Audit Logs",
    icon: "ShieldCheck",
    tagline: "Every mutation, forever",
    description:
      "Immutable record of every business-critical action. Order create, payment, refund, stock movement, role change, login — all logged with user, timestamp, and changes.",
    features: [
      { title: "Comprehensive Logging", description: "ORDER_CREATE, PAYMENT_CREATE, REFUND_CREATE, STOCK_ADJUST, USER_UPDATE, and 30+ more actions." },
      { title: "Per-Mutation Detail", description: "User, action, entity, entityId, changes (JSON), IP, timestamp." },
      { title: "Immutable", description: "No update or delete API exposed. Logs are append-only." },
      { title: "Filterable", description: "Filter by entity, action, userId, date range. Search across all fields." },
      { title: "Inside Transactions", description: "Audit writes happen inside the same transaction as the mutation (atomic)." },
      { title: "Forgery-Proof", description: "POST /audit does not accept client-supplied userId — always the authenticated user." },
    ],
    benefits: [
      "Know who did what, when, and what changed",
      "Pass audits with full transaction trails",
      "Investigate discrepancies with per-mutation detail",
      "Trust the log — it can't be edited or deleted",
    ],
  },
];

// ─── Footer link columns ───
export const FOOTER_LINKS: { label: string; href: string }[] = [
  // Product
  { label: "Features", href: "/features" },
  { label: "Pricing", href: "/pricing" },
  { label: "Integrations", href: "/integrations" },
  { label: "Kanban", href: "/product/kanban" },
  { label: "Automation", href: "/product/automation" },
  // Resources
  { label: "Documentation", href: "/resources/docs" },
  { label: "Help Center", href: "/resources/help" },
  { label: "Blog", href: "/resources/blog" },
  { label: "Tutorials", href: "/resources/tutorials" },
  { label: "Changelog", href: "/resources/changelog" },
  { label: "Support", href: "/resources/support" },
  // Company
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
  { label: "FAQ", href: "/faq" },
  // Legal
  { label: "Privacy", href: "/legal/privacy" },
  { label: "Terms", href: "/legal/terms" },
  { label: "Refund", href: "/legal/refund" },
  { label: "Cookies", href: "/legal/cookies" },
  { label: "Security", href: "/legal/security" },
  { label: "Data Protection", href: "/legal/data-protection" },
];

export const FOOTER_COLUMNS = [
  {
    title: "Product",
    links: [
      { label: "Features", href: "/features" },
      { label: "Pricing", href: "/pricing" },
      { label: "Integrations", href: "/integrations" },
      { label: "Use Cases", href: "/use-cases/ecommerce" },
      { label: "Kanban", href: "/product/kanban" },
      { label: "Automation", href: "/product/automation" },
    ],
  },
  {
    title: "Modules",
    links: [
      { label: "Order Management", href: "/product/order-management" },
      { label: "Inventory", href: "/product/inventory-management" },
      { label: "Customer Management", href: "/product/customer-management" },
      { label: "Finance & Accounting", href: "/product/finance-accounting" },
      { label: "Reports", href: "/product/reports-analytics" },
      { label: "Audit Logs", href: "/product/audit-logs" },
    ],
  },
  {
    title: "Integrations",
    links: [
      { label: "WooCommerce", href: "/integrations/woocommerce" },
      { label: "WhatsApp", href: "/integrations/whatsapp" },
      { label: "Facebook", href: "/integrations/facebook" },
      { label: "Telegram", href: "/integrations/telegram" },
      { label: "Couriers", href: "/integrations/courier" },
      { label: "Payments", href: "/integrations/payments" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Documentation", href: "/resources/docs" },
      { label: "Help Center", href: "/resources/help" },
      { label: "Blog", href: "/resources/blog" },
      { label: "Tutorials", href: "/resources/tutorials" },
      { label: "Changelog", href: "/resources/changelog" },
      { label: "Support", href: "/resources/support" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Contact", href: "/contact" },
      { label: "FAQ", href: "/faq" },
      { label: "Privacy", href: "/legal/privacy" },
      { label: "Terms", href: "/legal/terms" },
      { label: "Security", href: "/legal/security" },
    ],
  },
];

// ─── Security features ───
export const SECURITY_FEATURES = [
  { icon: "KeyRound", title: "HMAC-Signed Sessions", description: "Session cookies are HMAC-SHA256 signed with a 32+ char secret. Tamper-proof and verifiable server-side." },
  { icon: "Lock", title: "PBKDF2-600k Passwords", description: "Passwords hashed with PBKDF2-SHA256 at 600,000 iterations (OWASP 2023). Per-hash random 16-byte salt." },
  { icon: "ShieldCheck", title: "Server-Side RBAC", description: "60+ permissions checked on every API route. No client-side bypass possible." },
  { icon: "FileLock", title: "Immutable Audit Logs", description: "Every mutation logged inside the same transaction. No update or delete API. Append-only." },
  { icon: "Webhook", title: "Signed Webhooks", description: "All inbound webhooks (Meta, WhatsApp, Telegram, WooCommerce) verified with HMAC signatures." },
  { icon: "UserX", title: "Last-Admin Guard", description: "Prevents demoting or deleting the last super-admin so you never lock yourself out." },
  { icon: "EyeOff", title: "Token Masking", description: "Access tokens and app secrets are never returned to the client. Only masked previews." },
  { icon: "Gauge", title: "Rate Limiting", description: "Per-IP rate limits on login and registration. Timing-equalized user lookups." },
];

// ─── Workflow / kanban preview data ───
export const KANBAN_PREVIEW = {
  title: "Sales Pipeline",
  columns: [
    { id: "NEW", color: "bg-blue-500", items: [{ name: "Karim Hassan", value: "৳12,500" }, { name: "Nayeem Ahmed", value: "৳8,200" }] },
    { id: "CONTACTED", color: "bg-cyan-500", items: [{ name: "Sadia Islam", value: "৳15,000" }] },
    { id: "QUALIFIED", color: "bg-violet-500", items: [{ name: "Tanvir Rahman", value: "৳22,000" }, { name: "Fatima Begum", value: "৳3,500" }] },
    { id: "NEGOTIATION", color: "bg-amber-500", items: [{ name: "Rahim Ahmed", value: "৳45,000" }] },
    { id: "WON", color: "bg-emerald-500", items: [{ name: "Ayesha Siddique", value: "৳18,500" }] },
  ],
};

// ─── Analytics preview chart data ───
export const ANALYTICS_PREVIEW = [
  { month: "Jan", sales: 245000, expenses: 142000 },
  { month: "Feb", sales: 312000, expenses: 168000 },
  { month: "Mar", sales: 298000, expenses: 155000 },
  { month: "Apr", sales: 387000, expenses: 182000 },
  { month: "May", sales: 425000, expenses: 195000 },
  { month: "Jun", sales: 512000, expenses: 218000 },
  { month: "Jul", sales: 478000, expenses: 205000 },
  { month: "Aug", sales: 567000, expenses: 232000 },
];

// ─── Dashboard preview data ───
export const DASHBOARD_PREVIEW = {
  kpis: [
    { label: "Today's Sales", value: "৳48,250", trend: "+12%", tone: "emerald" },
    { label: "Today's Orders", value: "127", trend: "+8%", tone: "blue" },
    { label: "Today's Payments", value: "৳32,400", trend: "+15%", tone: "cyan" },
    { label: "Today's Profit", value: "৳18,720", trend: "+22%", tone: "emerald" },
  ],
  recentOrders: [
    { id: "ORD-001052", customer: "Karim Hassan", total: "৳1,890", status: "DELIVERED" },
    { id: "ORD-001051", customer: "Ayesha Siddique", total: "৳1,550", status: "SHIPPED" },
    { id: "ORD-001050", customer: "Tanvir Rahman", total: "৳4,180", status: "PROCESSING" },
    { id: "ORD-001049", customer: "Fatima Begum", total: "৳280", status: "CONFIRMED" },
  ],
};

// ─── Blog posts (for resources/blog) ───
export const BLOG_POSTS = [
  {
    title: "How Z-CRM's stock movement ledger prevents overselling",
    excerpt: "A deep dive into the ledger-based inventory architecture and how it eliminates the most common e-commerce pitfall.",
    date: "2026-08-15",
    readTime: "8 min",
    category: "Engineering",
  },
  {
    title: "Setting up WhatsApp Business Cloud API with Z-CRM",
    excerpt: "Step-by-step guide to connecting your WhatsApp Business account, verifying webhooks, and sending your first template message.",
    date: "2026-08-10",
    readTime: "12 min",
    category: "Tutorial",
  },
  {
    title: "Why historical COGS snapshots matter for profitability",
    excerpt: "How Z-CRM preserves your historical profit margins even when supplier prices change — and why most CRMs get this wrong.",
    date: "2026-08-05",
    readTime: "6 min",
    category: "Accounting",
  },
  {
    title: "Bangladesh courier integration: Pathao, Steadfast, RedX",
    excerpt: "Comparing the three major Bangladesh courier services and how Z-CRM's abstraction layer makes them interchangeable.",
    date: "2026-07-28",
    readTime: "10 min",
    category: "Integrations",
  },
  {
    title: "Automating order confirmations with the Z-CRM automation engine",
    excerpt: "Build a no-code workflow that sends a WhatsApp confirmation the moment an order is placed.",
    date: "2026-07-20",
    readTime: "7 min",
    category: "Automation",
  },
  {
    title: "Multi-warehouse inventory: transfers, reconciliation, and audit",
    excerpt: "How Z-CRM handles per-warehouse stock with transfer approval workflow and stock count reconciliation.",
    date: "2026-07-15",
    readTime: "11 min",
    category: "Inventory",
  },
];

// ─── Help center articles ───
export const HELP_ARTICLES = [
  { title: "Getting started with Z-CRM", category: "Onboarding", href: "/resources/help#getting-started" },
  { title: "Creating your first order", category: "Orders", href: "/resources/help#first-order" },
  { title: "Connecting WooCommerce", category: "Integrations", href: "/resources/help#woocommerce" },
  { title: "Setting up WhatsApp Business", category: "Integrations", href: "/resources/help#whatsapp" },
  { title: "Configuring roles and permissions", category: "Security", href: "/resources/help#roles" },
  { title: "Running a stock count", category: "Inventory", href: "/resources/help#stock-count" },
  { title: "Closing the cash register", category: "Finance", href: "/resources/help#cash-register" },
  { title: "Exporting reports to CSV", category: "Reports", href: "/resources/help#csv-export" },
  { title: "Using the Telegram bot", category: "Telegram", href: "/resources/help#telegram-bot" },
  { title: "Inviting team members", category: "Users", href: "/resources/help#invite-users" },
];

// ─── Changelog entries ───
export const CHANGELOG = [
  { version: "2.0.0", date: "2026-08-26", type: "Major", changes: ["Complete QA audit and hardening", "Webhook signature verification for all 4 providers", "Order status machine for Kanban DnD", "Wallet negative-amount exploit blocked", "P&L matches per-order profit formula"] },
  { version: "1.8.0", date: "2026-08-15", type: "Feature", changes: ["Telegram bot with 20+ commands", "Per-group RBAC for Telegram", "English + Bangla i18n", "Notification routing to Telegram groups"] },
  { version: "1.7.0", date: "2026-07-20", type: "Feature", changes: ["Billing & subscription system", "Wallet with deposits and withdrawals", "Payout management for super admins", "4 pricing plans"] },
  { version: "1.6.0", date: "2026-07-01", type: "Feature", changes: ["Multi-warehouse with transfer approval", "Stock count reconciliation", "Product variants and barcodes", "Purchase returns with supplier credit"] },
  { version: "1.5.0", date: "2026-06-15", type: "Feature", changes: ["Automation engine", "Event→rule→action workflow", "WhatsApp template notifications", "Non-blocking trigger execution"] },
  { version: "1.4.0", date: "2026-05-20", type: "Feature", changes: ["Courier integration (Pathao, Steadfast, RedX)", "Delivery status workflow", "COD tracking", "Cash register with daily closing"] },
  { version: "1.3.0", date: "2026-05-01", type: "Feature", changes: ["Sales pipeline kanban", "Lead pipeline kanban", "Meta Lead Ads auto-import", "Omnichannel inbox"] },
  { version: "1.2.0", date: "2026-04-15", type: "Feature", changes: ["Historical COGS snapshots", "P&L engine", "11 report types with CSV export", "Cash flow report"] },
  { version: "1.1.0", date: "2026-03-20", type: "Feature", changes: ["WooCommerce integration", "HMAC-signed webhooks", "Idempotent webhook processing", "Sync log"] },
  { version: "1.0.0", date: "2026-03-01", type: "Major", changes: ["Initial release", "Order management", "Inventory ledger", "Customer management", "RBAC with 6 roles"] },
];

// ─── Use case page content (extended) ───
export const USE_CASE_DETAILS = [
  {
    key: "ecommerce",
    name: "E-commerce",
    icon: "ShoppingBag",
    hero: "Sync WooCommerce, sell on WhatsApp, automate everything",
    description: "For online stores running WooCommerce, Facebook, WhatsApp, and Instagram. Z-CRM unifies orders, syncs inventory in real time, and automates customer confirmations so you never miss a message or oversell a product.",
    challenges: [
      { pain: "Orders scattered across 4 channels", solution: "Unified order queue with channel attribution" },
      { pain: "Overselling when stock is low", solution: "Stock reservation at order creation" },
      { pain: "Customers asking 'where is my order?'", solution: "Automated WhatsApp confirmations on each status change" },
      { pain: "Manual lead entry from Facebook Lead Ads", solution: "Auto-import leads with HMAC-verified webhooks" },
      { pain: "P&L is a guess at month-end", solution: "Real-time P&L with historical COGS snapshots" },
    ],
    workflow: ["WooCommerce order → Z-CRM", "Stock reserved", "WhatsApp confirmation sent", "Courier delivery created", "Stock converted on delivery", "P&L updated"],
    features: ["WooCommerce sync", "WhatsApp Business Cloud API", "Meta Lead Ads import", "Courier integration", "Automation engine", "P&L reports"],
  },
  {
    key: "retail",
    name: "Retail",
    icon: "Store",
    hero: "POS-style speed with full inventory tracking",
    description: "For brick-and-mortar stores. Fast order creation, barcode-ready products, cash register with daily closing, and low-stock reorder alerts — without the complexity of a full POS system.",
    challenges: [
      { pain: "Long checkout lines", solution: "Fast order creation screen, <30 seconds per order" },
      { pain: "Cash doesn't reconcile at end of day", solution: "Cash register with opening + inflows − outflows = closing" },
      { pain: "Stockouts surprise you", solution: "Automatic low-stock notifications with suggested reorder qty" },
      { pain: "Barcodes not scannable", solution: "Product variants with barcodes, scanner-ready" },
      { pain: "End-of-day reporting takes hours", solution: "One-click daily close + CSV export" },
    ],
    workflow: ["Customer at counter", "Fast order creation", "Cash or card payment", "Stock decremented", "Daily close", "P&L snapshot"],
    features: ["Fast order entry", "Cash register", "Barcode-ready products", "Low-stock alerts", "Multi-payment methods", "Daily closing"],
  },
  {
    key: "wholesale",
    name: "Wholesale",
    icon: "Package",
    hero: "B2B credit limits, bulk orders, supplier workflow",
    description: "For B2B wholesalers. Set credit limits per customer, track advance payments, process bulk orders, and manage supplier purchase orders — all with full audit trail.",
    challenges: [
      { pain: "Customers exceed credit limits", solution: "Per-customer credit limits with outstanding tracking" },
      { pain: "Advance payments get lost", solution: "Customer credit/advance tracking with audit log" },
      { pain: "Bulk order entry is slow", solution: "Bulk order creation with line-item discounts" },
      { pain: "Supplier dues unclear", solution: "Supplier dashboard with outstanding payable" },
      { pain: "Returns to suppliers untracked", solution: "Purchase returns with supplier credit" },
    ],
    workflow: ["Customer places bulk order", "Credit limit checked", "Stock reserved", "Advance payment recorded", "Delivery scheduled", "Invoice generated"],
    features: ["Customer credit limits", "Advance payments", "Bulk order entry", "Supplier dashboard", "Purchase returns", "Line-item discounts"],
  },
  {
    key: "distribution",
    name: "Distribution",
    icon: "Truck",
    hero: "Multi-warehouse, courier sync, live delivery tracking",
    description: "For distributors with multiple warehouses and delivery routes. Stock transfers between warehouses, courier integration, and live delivery tracking across regions.",
    challenges: [
      { pain: "Stock split across warehouses", solution: "Per-warehouse stock with transfer approval workflow" },
      { pain: "Too many courier apps", solution: "Pathao, Steadfast, RedX in one screen" },
      { pain: "Where is the delivery?", solution: "Live delivery status with full history" },
      { pain: "COD reconciliation is painful", solution: "COD tracking per delivery with courier returns" },
      { pain: "Returns from customers", solution: "Good and damaged returns with stock adjustment" },
    ],
    workflow: ["Order received", "Warehouse selected", "Stock reserved", "Courier delivery created", "Auto-ship", "Status tracked", "Delivered → sale converted"],
    features: ["Multi-warehouse", "Courier integration", "Delivery tracking", "COD management", "Stock transfers", "Returns"],
  },
  {
    key: "service-business",
    name: "Service Business",
    icon: "Wrench",
    hero: "Lead-to-cash workflow for service businesses",
    description: "For service businesses (agencies, consultants, repair shops). Capture leads from Meta Lead Ads, manage a sales pipeline, schedule appointments, and invoice clients — without a separate CRM.",
    challenges: [
      { pain: "Leads from Facebook go to email", solution: "Auto-import Meta Lead Ads into the CRM pipeline" },
      { pain: "No visibility into the pipeline", solution: "7-stage sales pipeline kanban with drag-and-drop" },
      { pain: "Follow-ups slip through the cracks", solution: "Scheduled follow-ups with assignment and due dates" },
      { pain: "Invoicing is manual", solution: "Convert won deals to orders with invoicing" },
      { pain: "Customer history scattered", solution: "360° customer profile with full history" },
    ],
    workflow: ["Lead captured", "Pipeline stage: NEW", "Salesperson assigned", "Follow-up scheduled", "Stages drag forward", "Won → customer + invoice"],
    features: ["Lead capture", "Sales pipeline", "Follow-ups", "Customer 360°", "Invoicing", "Lead analytics"],
  },
  {
    key: "multi-warehouse",
    name: "Multi-Warehouse",
    icon: "Warehouse",
    hero: "Per-warehouse stock with transfer approvals",
    description: "For businesses with multiple warehouses. Per-warehouse stock levels, transfer approval workflow, stock count reconciliation, and warehouse-specific reorder alerts.",
    challenges: [
      { pain: "Which warehouse has stock?", solution: "Per-warehouse stock levels in one view" },
      { pain: "Transfers go missing", solution: "Transfer approval workflow with audit trail" },
      { pain: "Stock counts never match", solution: "Stock count reconciliation with system vs counted vs difference" },
      { pain: "Reorder from the wrong warehouse", solution: "Per-warehouse reorder levels and alerts" },
      { pain: "Damaged stock mixed with sellable", solution: "Damaged bucket separate from sellable, with full audit" },
    ],
    workflow: ["Stock needed at WH-B", "Transfer request created", "WH-A approval", "Stock moved (TRANSFER_OUT + TRANSFER_IN)", "Per-WH stock updated", "Ledger logged"],
    features: ["Per-warehouse stock", "Transfer approvals", "Stock reconciliation", "Per-WH reorder alerts", "Damaged bucket", "Full ledger"],
  },
];

// ─── Integration page content (extended) ───
export const INTEGRATION_DETAILS = [
  {
    key: "woocommerce",
    name: "WooCommerce",
    icon: "ShoppingBag",
    color: "#7f54b3",
    category: "E-commerce Platform",
    tagline: "Two-way sync of orders, products, and customers",
    description: "Connect your WooCommerce store to Z-CRM and sync orders, products, and customers in real time via REST API and HMAC-signed webhooks. Your CRM stays independent from WordPress — a WordPress outage doesn't take down your CRM.",
    features: [
      { title: "Real-Time Order Sync", description: "New WooCommerce orders appear in Z-CRM instantly via HMAC-signed webhooks." },
      { title: "Product Sync", description: "Sync product name, SKU, price, and stock from WooCommerce to Z-CRM." },
      { title: "Customer Sync", description: "Customer details from WooCommerce sync to the unified customer database." },
      { title: "HMAC Signature Verification", description: "Every webhook verified with HMAC-SHA256. No unsigned POSTs accepted." },
      { title: "Idempotent Processing", description: "Duplicate deliveries deduplicated by externalId — never double-process an order." },
      { title: "Sync Log", description: "Every sync event logged with status, payload hash, and timestamp." },
    ],
    setup: ["Install the Z-CRM plugin or configure webhooks in WooCommerce", "Set the webhook secret in Z-CRM", "Enter your WooCommerce REST API credentials", "Click 'Sync Now' to backfill existing orders"],
    href: "/integrations/woocommerce",
  },
  {
    key: "whatsapp",
    name: "WhatsApp Business Cloud API",
    icon: "MessageCircle",
    color: "#25d366",
    category: "Messaging",
    tagline: "Inbound messages, outbound templates, order-from-conversation",
    description: "Connect WhatsApp Business Cloud API to Z-CRM and unify every customer conversation. Inbound messages flow into the omnichannel inbox; outbound template messages can be sent manually or triggered by automation rules.",
    features: [
      { title: "Omnichannel Inbox", description: "WhatsApp, Messenger, and Instagram DMs in one inbox." },
      { title: "Inbound Webhook", description: "HMAC-verified webhooks create conversations and messages in real time." },
      { title: "Outbound Templates", description: "Send pre-approved template messages via the Cloud API." },
      { title: "Order from Conversation", description: "Create an order from a WhatsApp conversation in two clicks." },
      { title: "Automation Triggers", description: "Auto-send confirmations on ORDER_CREATED, ORDER_SHIPPED, etc." },
      { title: "Customer Dedup", description: "Phone normalization unifies WhatsApp customers with Meta and WooCommerce." },
    ],
    setup: ["Create a Meta for Developers app", "Add the WhatsApp Business Cloud API product", "Configure the webhook URL with your App Secret", "Subscribe to messages and status webhooks", "Set the App Secret in Z-CRM"],
    href: "/integrations/whatsapp",
  },
  {
    key: "facebook",
    name: "Facebook Lead Ads",
    icon: "Facebook",
    color: "#1877f2",
    category: "Marketing",
    tagline: "Auto-import leads with HMAC-verified webhooks",
    description: "Connect your Facebook Lead Ads to Z-CRM and every new lead is automatically imported, deduplicated by phone, and added to your lead pipeline. No more manual entry, no more missed leads.",
    features: [
      { title: "Auto-Import", description: "New leads from Facebook Lead Ads flow into Z-CRM automatically via webhooks." },
      { title: "HMAC Verification", description: "Every webhook verified with X-Hub-Signature-256. Forged leads rejected." },
      { title: "Phone Dedup", description: "Normalize phones across Meta, WhatsApp, and manual entry to dedup customers." },
      { title: "Lead Pipeline", description: "Imported leads appear in the NEW stage of the lead pipeline kanban." },
      { title: "Lead Conversion", description: "Convert a lead to a customer in one click; preserve campaign attribution." },
      { title: "Multi-Connection", description: "Connect multiple Facebook Pages and Instagram accounts." },
    ],
    setup: ["Create a Meta for Developers app", "Add the Leadgen webhooks product", "Subscribe to leadgen events", "Configure the webhook verify token", "Set the App Secret in Z-CRM"],
    href: "/integrations/facebook",
  },
  {
    key: "messenger",
    name: "Facebook Messenger",
    icon: "MessageSquare",
    color: "#0084ff",
    category: "Messaging",
    tagline: "Unified omnichannel inbox with Messenger",
    description: "Facebook Messenger conversations appear alongside WhatsApp and Instagram in the Z-CRM omnichannel inbox. Reply from one place, link conversations to customers, and create orders from chat.",
    features: [
      { title: "Unified Inbox", description: "Messenger, WhatsApp, and Instagram in one inbox." },
      { title: "Customer Linking", description: "Auto-link conversations to customer records by phone or name." },
      { title: "Order from Chat", description: "Create an order from a Messenger conversation in two clicks." },
      { title: "Conversation Tags", description: "Tag conversations: NEW_LEAD, EXISTING_CUSTOMER, ORDER_QUERY, COMPLAINT." },
      { title: "Internal Notes", description: "Add internal notes to conversations for team collaboration." },
      { title: "Assignment", description: "Assign conversations to specific team members." },
    ],
    setup: ["Connect your Facebook Page in the Z-CRM Meta integration", "Subscribe to messenger webhooks", "Verify the webhook challenge", "Start chatting"],
    href: "/integrations/messenger",
  },
  {
    key: "telegram",
    name: "Telegram Bot",
    icon: "Send",
    color: "#26a5e4",
    category: "Operations",
    tagline: "20+ commands, group-based RBAC, English + Bangla",
    description: "Operate Z-CRM from your phone via Telegram. 20+ commands cover orders, customers, inventory, payments, leads, reports, and more. Each Telegram group maps to a CRM role, so members only see what their role permits.",
    features: [
      { title: "20+ Commands", description: "/orders, /customers, /inventory, /payments, /leads, /reports, /cash, /deliveries, /returns, /purchases, /suppliers, /expenses, /products, /stockcount, /movements, /warehouses, /transfers, /inbox, /notifications, /pipeline." },
      { title: "Group-Based RBAC", description: "Each Telegram group maps to a CRM role. Members only see data their role permits." },
      { title: "Inline Keyboards", description: "Pagination, action buttons, and confirmation flows for sensitive actions." },
      { title: "English + Bangla", description: "Bot responds in English or Bangla based on group configuration." },
      { title: "Notification Routing", description: "Route CRM events (NEW_ORDER, LOW_STOCK, PAYMENT_RECEIVED) to specific Telegram groups." },
      { title: "Idempotent Webhook", description: "Duplicate Telegram updates deduplicated by update_id." },
    ],
    setup: ["Create a Telegram bot via @BotFather", "Set the bot token in Z-CRM", "Configure the webhook secret token", "Add the bot to your Telegram group", "Map the group to a CRM role"],
    href: "/integrations/telegram",
  },
  {
    key: "courier",
    name: "Courier Integration",
    icon: "Truck",
    color: "#f59e0b",
    category: "Logistics",
    tagline: "Pathao, Steadfast, RedX — all in one screen",
    description: "Create deliveries with any Bangladesh courier, auto-ship on order confirmation, track status, and convert reservations to sales on delivery. A single API across all three couriers.",
    features: [
      { title: "Pathao", description: "Full integration with Pathao's delivery API." },
      { title: "Steadfast", description: "Create and track Steadfast deliveries from Z-CRM." },
      { title: "RedX", description: "RedX delivery integration with status tracking." },
      { title: "Auto-Ship", description: "Optionally auto-create and ship the delivery when the order is confirmed." },
      { title: "Status Sync", description: "Delivery status changes sync back to the order (SHIPPED, DELIVERED)." },
      { title: "COD Tracking", description: "Cash-on-delivery amount per delivery. Reconcile with courier returns." },
    ],
    setup: ["Get API credentials from your courier (Pathao, Steadfast, or RedX)", "Add the credentials in Z-CRM Couriers settings", "Choose a default courier for new deliveries", "Enable auto-ship if desired"],
    href: "/integrations/courier",
  },
  {
    key: "bkash",
    name: "bKash",
    icon: "Smartphone",
    color: "#e2136e",
    category: "Payments",
    tagline: "Record bKash payments with transaction references",
    description: "Record every bKash payment with the transaction ID for reconciliation. bKash payments appear in the cash register (if marked as cash) and in payment reports by method.",
    features: [
      { title: "Transaction References", description: "Every bKash payment can store the bKash transaction ID for reconciliation." },
      { title: "Payment Method Filter", description: "Filter payments by method=BKASH for reconciliation with bKash statements." },
      { title: "Cash Register Inclusion", description: "Mark bKash as cash-like for the cash register, or treat separately." },
      { title: "Payment Reports", description: "Payments report includes bKash total and count." },
      { title: "Auto Payment Status", description: "Recording a bKash payment auto-recomputes the order's payment status." },
      { title: "Overpayment Prevention", description: "Reject payments that exceed the order total." },
    ],
    setup: ["No API credentials needed — Z-CRM records bKash payments manually", "Record the bKash transaction ID for each payment", "Reconcile with your bKash statement using the payments report"],
    href: "/integrations/bkash",
  },
  {
    key: "nagad",
    name: "Nagad",
    icon: "Smartphone",
    color: "#ec1c24",
    category: "Payments",
    tagline: "Record Nagad payments with transaction references",
    description: "Record every Nagad payment with the transaction ID for reconciliation. Nagad payments are tracked separately from bKash and appear in payment reports by method.",
    features: [
      { title: "Transaction References", description: "Every Nagad payment can store the Nagad transaction ID." },
      { title: "Payment Method Filter", description: "Filter payments by method=NAGAD for reconciliation." },
      { title: "Auto Payment Status", description: "Recording a Nagad payment auto-recomputes the order's payment status." },
      { title: "Payment Reports", description: "Payments report includes Nagad total and count." },
      { title: "Overpayment Prevention", description: "Reject payments that exceed the order total." },
      { title: "Audit Trail", description: "Every Nagad payment recorded in the immutable audit log." },
    ],
    setup: ["No API credentials needed — Z-CRM records Nagad payments manually", "Record the Nagad transaction ID for each payment", "Reconcile with your Nagad statement using the payments report"],
    href: "/integrations/nagad",
  },
  {
    key: "payments",
    name: "Payment Gateways",
    icon: "CreditCard",
    color: "#10b981",
    category: "Payments",
    tagline: "All Bangladesh payment methods + wallet",
    description: "All Bangladesh payment methods in one place: cash, bKash, Nagad, bank, card, and wallet. The Z-CRM wallet handles subscription billing, deposits, withdrawals, and payouts.",
    features: [
      { title: "All Methods", description: "CASH, BKASH, NAGAD, BANK, CARD, WALLET, OTHER — validated at the API." },
      { title: "Wallet", description: "Wallet for subscriptions, deposits, withdrawals, and payouts." },
      { title: "Payment Gateways", description: "Configurable gateways (bKash, Nagad, Bank, Cash) for subscription billing." },
      { title: "Subscription Billing", description: "Auto-recurring billing via wallet or payment gateway." },
      { title: "Payout Management", description: "Super admins approve, complete, or reject payout requests." },
      { title: "Reconciliation", description: "Payment reports by method for accounting reconciliation." },
    ],
    setup: ["Choose your subscription plan", "Select a payment method (bKash, Nagad, Bank, Wallet)", "Complete the payment", "Your subscription activates automatically"],
    href: "/integrations/payments",
  },
];
