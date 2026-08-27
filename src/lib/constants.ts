// Centralized enums and constants for the CRM.
// SQLite has no native enums; these are validated in code and stored as strings.

export const ORDER_STATUS = [
  "PENDING",
  "CONFIRMED",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
  "RETURNED",
  "REFUNDED",
] as const;
export type OrderStatus = (typeof ORDER_STATUS)[number];

export const PAYMENT_STATUS = ["UNPAID", "PARTIAL", "PAID", "REFUNDED"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUS)[number];

export const PURCHASE_STATUS = ["PENDING", "RECEIVED", "CANCELLED"] as const;
export type PurchaseStatus = (typeof PURCHASE_STATUS)[number];

export const RETURN_STATUS = ["PENDING", "COMPLETED", "CANCELLED"] as const;
export type ReturnStatus = (typeof RETURN_STATUS)[number];

export const RETURN_TYPE = ["RETURN", "EXCHANGE"] as const;

export const ITEM_CONDITION = ["GOOD", "DAMAGED"] as const;

export const STOCK_MOVEMENT_TYPE = [
  "PURCHASE",
  "SALE",
  "RETURN",
  "DAMAGE",
  "DAMAGED_RETURN", // customer returned a damaged item — only increases damaged bucket
  "ADJUSTMENT",
  "TRANSFER_IN",
  "TRANSFER_OUT",
  "RESERVATION",
  "RELEASE",
] as const;
export type StockMovementType = (typeof STOCK_MOVEMENT_TYPE)[number];

export const PAYMENT_METHODS = ["CASH", "BKASH", "NAGAD", "BANK", "CARD", "WALLET", "OTHER"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const EXPENSE_CATEGORIES = [
  "Delivery",
  "Packaging",
  "Marketing",
  "Salary",
  "Rent",
  "Utility",
  "Office",
  "Transport",
  "Other",
] as const;

export const ORDER_CHANNELS = [
  "Website",
  "Facebook",
  "Messenger",
  "WhatsApp",
  "Instagram",
  "Phone",
  "Physical Store",
  "Other",
] as const;

export const CONVERSATION_STATUS = ["OPEN", "PENDING", "RESOLVED", "CLOSED"] as const;
export type ConversationStatus = (typeof CONVERSATION_STATUS)[number];

export const MESSAGE_DIRECTION = ["INCOMING", "OUTGOING"] as const;

export const WEBHOOK_PROVIDERS = ["meta", "whatsapp", "woocommerce"] as const;
export const WEBHOOK_EVENT_STATUS = ["PENDING", "SUCCESS", "FAILED", "RETRYING", "IGNORED"] as const;

export const TRANSFER_STATUS = ["PENDING", "COMPLETED", "CANCELLED"] as const;
export const LEAD_STATUS = ["NEW", "CONTACTED", "CONVERTED", "ARCHIVED"] as const;

export const ROLES = [
  "SUPER_ADMIN",
  "ADMIN",
  "MANAGER",
  "SALES",
  "INVENTORY",
  "ACCOUNTANT",
] as const;
export type RoleName = (typeof ROLES)[number];

// ---------------------------------------------------------------------------
// Granular permissions
// ---------------------------------------------------------------------------

export const PERMISSIONS = [
  "dashboard:read",

  "orders:read",
  "orders:create",
  "orders:update",
  "orders:delete",
  "orders:cancel",

  "customers:read",
  "customers:create",
  "customers:update",
  "customers:delete",

  "products:read",
  "products:create",
  "products:update",
  "products:delete",

  "categories:read",
  "categories:create",
  "categories:update",
  "categories:delete",

  "suppliers:read",
  "suppliers:create",
  "suppliers:update",
  "suppliers:delete",

  "inventory:read",
  "inventory:adjust",

  "purchases:read",
  "purchases:create",
  "purchases:update",

  "payments:read",
  "payments:create",
  "payments:refund",

  "expenses:read",
  "expenses:create",
  "expenses:update",
  "expenses:delete",

  "returns:read",
  "returns:create",
  "returns:update",

  "refunds:read",
  "refunds:create",

  "reports:read",
  "exports:read",

  "users:read",
  "users:create",
  "users:update",
  "users:delete",

  "roles:read",
  "roles:create",
  "roles:update",
  "roles:delete",

  "settings:read",
  "settings:update",

  "audit_logs:read",

  "integrations:read",
  "integrations:update",
  "integrations:sync",

  "conversations:read",
  "conversations:create",
  "conversations:update",
  "conversations:assign",

  "messages:send",

  "message_templates:read",
  "message_templates:create",
  "message_templates:update",
  "message_templates:delete",

  "leads:read",
  "leads:update",

  "warehouses:read",
  "warehouses:create",
  "warehouses:update",
  "warehouses:delete",

  "stock_transfers:read",
  "stock_transfers:create",

  "webhook_events:read",
  "webhook_events:retry",

  "deliveries:read",
  "deliveries:update",

  "automation:read",
  "automation:update",

  "stock_counts:read",
  "stock_counts:approve",

  "pipelines:read",
  "pipelines:update",

  // Cash register: closing the day requires a dedicated permission so a
  // SALES user (who has expenses:read but not expenses:update) cannot
  // close the register; MANAGER + ACCOUNTANT + ADMIN can.
  "cash:manage",

  // Supplier payments: separating customer payments from supplier payments
  // prevents SALES (who has payments:create for customer payments) from
  // paying suppliers — a finance/purchasing operation.
  "purchases:pay",

  "telegram:read",
  "telegram:update",
  "telegram:sync",

  "billing:read",
  "billing:create",
  "billing:update",
  "billing:verify",
  "billing:refund",
  "billing:manage_gateways",
  "billing:manage_payouts",

  "notifications:read",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

// Map each role to the set of permissions it grants.
// SUPER_ADMIN gets everything (also enforced server-side).
export const ROLE_PERMISSIONS: Record<RoleName, Permission[]> = {
  SUPER_ADMIN: [...PERMISSIONS],
  ADMIN: [...PERMISSIONS],
  MANAGER: [
    "dashboard:read",
    "orders:read", "orders:create", "orders:update", "orders:cancel",
    "customers:read", "customers:create", "customers:update", "customers:delete",
    "products:read", "products:create", "products:update",
    "categories:read",
    "suppliers:read", "suppliers:create", "suppliers:update",
    "inventory:read", "inventory:adjust",
    "purchases:read", "purchases:create", "purchases:update", "purchases:pay",
    "payments:read", "payments:create",
    "expenses:read", "expenses:create", "expenses:update",
    "returns:read", "returns:create", "returns:update",
    "refunds:read", "refunds:create",
    "reports:read", "exports:read",
    "conversations:read", "conversations:create", "conversations:update", "conversations:assign",
    "messages:send",
    "message_templates:read",
    "leads:read", "leads:update",
    "warehouses:read",
    "stock_transfers:read", "stock_transfers:create",
    "stock_counts:read", "stock_counts:approve",
    "deliveries:read", "deliveries:update",
    "pipelines:read", "pipelines:update",
    "cash:manage",
    "automation:read", "automation:update",
    "notifications:read",
  ],
  SALES: [
    "dashboard:read",
    "orders:read", "orders:create", "orders:update", "orders:cancel",
    "customers:read", "customers:create", "customers:update",
    "products:read",
    "categories:read",
    "payments:read", "payments:create",
    "returns:read", "returns:create",
    "deliveries:read", "deliveries:update",
    "conversations:read", "conversations:create", "conversations:update", "conversations:assign",
    "messages:send",
    "message_templates:read",
    "leads:read", "leads:update",
    "pipelines:read", "pipelines:update",
    "notifications:read",
  ],
  INVENTORY: [
    "dashboard:read",
    "products:read", "products:create", "products:update",
    "categories:read", "categories:create", "categories:update",
    "suppliers:read", "suppliers:create", "suppliers:update",
    "inventory:read", "inventory:adjust",
    "purchases:read", "purchases:create", "purchases:update",
    "warehouses:read", "warehouses:create", "warehouses:update",
    "stock_transfers:read", "stock_transfers:create",
    "stock_counts:read",
    "notifications:read",
  ],
  ACCOUNTANT: [
    "dashboard:read",
    "payments:read", "payments:create", "payments:refund",
    "expenses:read", "expenses:create", "expenses:update", "expenses:delete",
    "refunds:read", "refunds:create",
    "reports:read", "exports:read",
    "orders:read",
    "customers:read",
    "purchases:read", "purchases:pay",
    "cash:manage",
    "notifications:read",
  ],
};

export const AUDIT_ACTIONS = {
  LOGIN: "LOGIN",
  LOGOUT: "LOGOUT",
  ORDER_CREATE: "ORDER_CREATE",
  ORDER_UPDATE: "ORDER_UPDATE",
  ORDER_CANCEL: "ORDER_CANCEL",
  PAYMENT_CREATE: "PAYMENT_CREATE",
  REFUND_CREATE: "REFUND_CREATE",
  PRODUCT_CREATE: "PRODUCT_CREATE",
  PRODUCT_UPDATE: "PRODUCT_UPDATE",
  STOCK_ADJUST: "STOCK_ADJUST",
  PURCHASE_CREATE: "PURCHASE_CREATE",
  PURCHASE_RECEIVE: "PURCHASE_RECEIVE",
  EXPENSE_CREATE: "EXPENSE_CREATE",
  EXPENSE_UPDATE: "EXPENSE_UPDATE",
  RETURN_CREATE: "RETURN_CREATE",
  USER_CREATE: "USER_CREATE",
  USER_UPDATE: "USER_UPDATE",
  PERMISSION_CHANGE: "PERMISSION_CHANGE",
  SETTINGS_UPDATE: "SETTINGS_UPDATE",
  WOOCOMMERCE_SYNC: "WOOCOMMERCE_SYNC",
  STOCK_TRANSFER: "STOCK_TRANSFER",
  META_CONNECT: "META_CONNECT",
  META_WEBHOOK: "META_WEBHOOK",
  WHATSAPP_CONNECT: "WHATSAPP_CONNECT",
  WHATSAPP_WEBHOOK: "WHATSAPP_WEBHOOK",
  MESSAGE_SEND: "MESSAGE_SEND",
  CONVERSATION_ASSIGN: "CONVERSATION_ASSIGN",
} as const;
