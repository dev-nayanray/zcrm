import { z } from "zod";

// Reusable primitives — MongoDB stores monetary values as Float (number).
// The decimalStr schema converts string/number input to a JavaScript number
// for Prisma Float fields. The toDecimal() helper converts numbers back to
// Prisma.Decimal for precise monetary calculations at the application layer.
export const decimalStr = z
  .union([z.string(), z.number()])
  .transform((v) => (v === "" || v === null ? 0 : Number(v)))
  .refine((v) => !isNaN(v), "Must be a valid number")
  .refine((v) => v >= 0, "Must be non-negative");

// Strict positive decimal — rejects 0 and negative. Use for amounts where
// 0 is meaningless (payments, refunds, deposits, advances).
export const positiveDecimalStr = decimalStr.refine(
  (v) => v > 0,
  "Must be greater than zero",
);

// Payment methods used across the system. Mirrors src/lib/constants.ts.
export const paymentMethodEnum = z.enum([
  "CASH",
  "BKASH",
  "NAGAD",
  "BANK",
  "CARD",
  "WALLET",
  "OTHER",
]);

// Strict finite decimal used for stock quantity changes.
const decimalChange = z
  .union([z.string(), z.number()])
  .transform((v) => (v === "" || v === null ? 0 : Number(v)))
  .refine((v) => !isNaN(v) && isFinite(v), "Must be a finite number");

const nonNeg = (msg = "Must be non-negative") =>
  z.coerce.number().refine((n) => n >= 0, msg);

const id = z.string().min(1, "Required");

// Pagination & search query
export const paginationQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(20),
  search: z.string().optional(),
  sort: z.string().optional(),
  order: z.enum(["asc", "desc"]).default("desc"),
});

export const dateRangeQuery = paginationQuery.extend({
  from: z.string().optional(),
  to: z.string().optional(),
  preset: z.string().optional(),
});

// --- Customer ---
export const createCustomerSchema = z.object({
  name: z.string().min(2, "Name too short"),
  phone: z.string().min(4, "Phone required"),
  email: z.string().email().optional().or(z.literal("")),
  address: z.string().optional(),
  city: z.string().optional(),
  notes: z.string().optional(),
  externalId: z.string().optional(),
});

export const updateCustomerSchema = createCustomerSchema.partial();

// --- Category ---
export const createCategorySchema = z.object({
  name: z.string().min(2),
  slug: z.string().optional(),
  description: z.string().optional(),
  imageUrl: z.string().optional(),
  parentId: z.string().optional().nullable(),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
  sortOrder: z.coerce.number().int().default(0),
  externalId: z.string().optional(),
});

export const updateCategorySchema = createCategorySchema.partial();

// --- Product ---
export const createProductSchema = z.object({
  sku: z.string().min(1, "SKU required"),
  name: z.string().min(2),
  slug: z.string().optional(),
  description: z.string().optional(),
  categoryId: z.string().optional().nullable(),
  brand: z.string().optional(),
  purchasePrice: decimalStr,
  sellingPrice: decimalStr,
  wholesalePrice: decimalStr.default(0),
  minimumStockLevel: decimalStr.default(0),
  imageUrl: z.string().optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
  externalId: z.string().optional(),
});

export const updateProductSchema = createProductSchema.partial();

// --- Supplier ---
export const createSupplierSchema = z.object({
  name: z.string().min(2),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  address: z.string().optional(),
  company: z.string().optional(),
  notes: z.string().optional(),
});

export const updateSupplierSchema = createSupplierSchema.partial();

// --- Order ---
export const orderItemInput = z.object({
  productId: id,
  quantity: decimalStr,
  discount: decimalStr.default(0),
});

export const createOrderSchema = z.object({
  customerId: id,
  channelId: id.optional(),
  status: z.string().default("PENDING"),
  discount: decimalStr.default(0),
  shippingCost: decimalStr.default(0),
  otherCost: decimalStr.default(0),
  notes: z.string().optional(),
  sourceChannel: z.string().optional(),
  externalId: z.string().optional(),
  reserveStock: z.boolean().default(false),
  conversationId: z.string().optional(),
  items: z.array(orderItemInput).min(1, "At least one item required"),
  payment: z
    .object({
      amount: decimalStr.default(0),
      method: z.string().default("CASH"),
      transactionReference: z.string().optional(),
      notes: z.string().optional(),
    })
    .optional(),
});

export const updateOrderStatusSchema = z.object({
  status: z.enum([
    "PENDING",
    "CONFIRMED",
    "PROCESSING",
    "SHIPPED",
    "DELIVERED",
    "CANCELLED",
    "RETURNED",
    "REFUNDED",
  ]),
  note: z.string().optional(),
});

// --- Payment ---
export const createPaymentSchema = z.object({
  amount: positiveDecimalStr,
  method: paymentMethodEnum,
  transactionReference: z.string().optional(),
  notes: z.string().optional(),
});

// --- Purchase ---
export const purchaseItemInput = z.object({
  productId: id,
  quantity: decimalStr,
  unitCost: decimalStr,
});

export const createPurchaseSchema = z.object({
  supplierId: id,
  discount: decimalStr.default(0),
  shippingCost: decimalStr.default(0),
  notes: z.string().optional(),
  paidAmount: decimalStr.default(0),
  items: z.array(purchaseItemInput).min(1),
  receive: z.boolean().default(true),
});

export const receivePurchaseSchema = z.object({});

// --- Expense ---
export const createExpenseSchema = z.object({
  categoryId: id,
  amount: positiveDecimalStr,
  paymentMethod: paymentMethodEnum,
  description: z.string().optional(),
  reference: z.string().optional(),
  expenseDate: z.string().optional(),
  // Optional links — order-specific / supplier / warehouse expenses.
  // General business expenses leave all three null.
  orderId: id.optional(),
  supplierId: id.optional(),
  warehouseId: id.optional(),
});

export const updateExpenseSchema = createExpenseSchema.partial();

// --- Return ---
export const returnItemInput = z.object({
  productId: id,
  quantity: positiveDecimalStr,
  condition: z.enum(["GOOD", "DAMAGED"]).default("GOOD"),
});

export const createReturnSchema = z.object({
  orderId: id,
  type: z.enum(["RETURN", "EXCHANGE"]).default("RETURN"),
  reason: z.string().optional(),
  refundAmount: decimalStr.default(0),
  items: z.array(returnItemInput).min(1),
  refund: z
    .object({
      method: paymentMethodEnum.default("CASH"),
      transactionReference: z.string().optional(),
      notes: z.string().optional(),
    })
    .optional(),
});

// --- Refund ---
export const createRefundSchema = z.object({
  amount: positiveDecimalStr,
  method: paymentMethodEnum.default("CASH"),
  paymentId: z.string().optional().nullable(),
  returnId: z.string().optional().nullable(),
  transactionReference: z.string().optional(),
  notes: z.string().optional(),
});

// --- User ---
export const createUserSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().optional(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  roleName: z.enum(["SUPER_ADMIN", "ADMIN", "MANAGER", "SALES", "INVENTORY", "ACCOUNTANT"]),
  isActive: z.boolean().default(true),
});

export const updateUserSchema = z
  .object({
    name: z.string().min(2).optional(),
    email: z.string().email().optional(),
    phone: z.string().optional(),
    password: z.string().min(8).optional(),
    roleName: z.enum(["SUPER_ADMIN", "ADMIN", "MANAGER", "SALES", "INVENTORY", "ACCOUNTANT"]).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, "No fields to update");

// --- Auth ---
export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// --- Integration ---
// All fields optional so a user can update just the URL or webhook secret
// without re-entering the consumer secret (which is never returned to the
// client). The WooCommerceService.saveConfig merges with the existing config
// so empty/omitted fields keep their previous value.
export const updateWooIntegrationSchema = z
  .object({
    url: z.string().url().or(z.literal("")).optional(),
    consumerKey: z.string().optional(),
    consumerSecret: z.string().optional(),
    webhookSecret: z.string().optional(),
  })
  .refine((d) => Object.values(d).some((v) => v !== undefined && v !== ""), "Provide at least one field to update");

// --- Inventory adjustment ---
export const stockAdjustmentSchema = z
  .object({
    productId: id,
    type: z.enum(["ADJUSTMENT", "DAMAGE", "TRANSFER_IN", "TRANSFER_OUT"]),
    quantityChange: decimalChange,
    reason: z.string().optional(),
  })
  .refine(
    (v) => {
      // Per-type sign validation: DAMAGE/TRANSFER_IN must be positive;
      // TRANSFER_OUT must be negative; ADJUSTMENT may be any sign.
      const n = Number(v.quantityChange);
      if (v.type === "DAMAGE" || v.type === "TRANSFER_IN") return n > 0;
      if (v.type === "TRANSFER_OUT") return n < 0;
      return true;
    },
    {
      message:
        "DAMAGE/TRANSFER_IN must be positive; TRANSFER_OUT must be negative",
      path: ["quantityChange"],
    },
  );

// --- Settings ---
export const updateSettingsSchema = z.object({
  settings: z.record(z.string(), z.string()),
});
