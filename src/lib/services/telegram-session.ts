// Telegram session state for multi-step conversation flows (e.g. /createorder).
//
// ─────────────────────────────────────────────────────────────────────────────
// DESIGN
// ─────────────────────────────────────────────────────────────────────────────
// Multi-step forms (customer → product → qty → payment → confirm) need a
// per-user conversation state that survives between messages. We use an
// in-memory Map keyed by `${telegramUserId}:${chatId}` — scoped to the user
// + chat so a user can't hijack another user's draft by guessing a
// callback_data.
//
// SECURITY:
//   - The session key includes BOTH telegramUserId AND chatId — a callback
//     from user A in chat X can never touch user B's draft in chat Y.
//   - Every callback handler re-resolves permissions via resolveContext
//     before applying any mutation — session state alone never authorises
//     an action.
//   - Sessions auto-expire after 10 minutes of inactivity to prevent
//     stale drafts from being committed accidentally.
//   - The session store is in-memory (single-instance). For multi-instance
//     deployments (Vercel serverless), a future enhancement would move
//     this to Redis or a DB-backed session table. For the typical SME
//     deployment on a single Vercel instance, in-memory is sufficient.
//
// ─────────────────────────────────────────────────────────────────────────────
// USAGE
// ─────────────────────────────────────────────────────────────────────────────
//   const session = TelegramSessionStore.startOrderDraft(telegramUserId, chatId);
//   session.draft.customerId = "cust_123";
//   TelegramSessionStore.save(session);
//   const loaded = TelegramSessionStore.getOrderDraft(telegramUserId, chatId);
//   if (!loaded) return send("Session expired — please /createorder again");
//
// ─────────────────────────────────────────────────────────────────────────────
// CALLBACK DATA SAFETY
// ─────────────────────────────────────────────────────────────────────────────
// Callback data like `orderdraft_select_product:product_123` is sent to
// Telegram and could theoretically be triggered by any user in the chat.
// The handler ALWAYS re-resolves the session by (telegramUserId, chatId)
// from the callback sender — not from the callback data itself. So even
// if user B taps a button intended for user A's draft, the handler loads
// user B's (empty) session and refuses to mutate user A's draft.

export type OrderDraftItem = {
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  unitCost: number;
  variationId?: string;
  variationName?: string;
};

export type OrderDraft = {
  telegramUserId: string;
  chatId: string;
  step: "customer" | "product_search" | "product_select" | "variation" | "quantity" | "add_more" | "shipping" | "discount" | "payment_method" | "payment_amount" | "confirm" | "done";
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  items: OrderDraftItem[];
  shippingCost: number;
  discount: number;
  tax: number;
  paymentMethod?: string;
  paymentAmount?: number;
  // The product the user is currently configuring (before it's added to items[]).
  pendingProduct?: { productId: string; productName: string; sku: string; unitPrice: number; unitCost: number; isVariable: boolean };
  pendingVariationId?: string;
  // Pagination cursor for the product/customer search (so Back works).
  lastSearchQuery?: string;
  lastSearchPage?: number;
  createdAt: number;
  updatedAt: number;
};

const SESSION_TTL_MS = 10 * 60 * 1000; // 10 minutes

// In-memory store. Key: `${telegramUserId}:${chatId}`.
const store = new Map<string, OrderDraft>();

function sessionKey(telegramUserId: string, chatId: string): string {
  return `${telegramUserId}:${chatId}`;
}

export const TelegramSessionStore = {
  /** Start a new order draft for a user+chat. Replaces any existing draft. */
  startOrderDraft(telegramUserId: string, chatId: string): OrderDraft {
    const draft: OrderDraft = {
      telegramUserId,
      chatId,
      step: "customer",
      items: [],
      shippingCost: 0,
      discount: 0,
      tax: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    store.set(sessionKey(telegramUserId, chatId), draft);
    return draft;
  },

  /** Get the active order draft, or null if none / expired. */
  getOrderDraft(telegramUserId: string, chatId: string): OrderDraft | null {
    const key = sessionKey(telegramUserId, chatId);
    const draft = store.get(key);
    if (!draft) return null;
    // Expire if no activity for SESSION_TTL_MS.
    if (Date.now() - draft.updatedAt > SESSION_TTL_MS) {
      store.delete(key);
      return null;
    }
    return draft;
  },

  /** Save an updated draft (refreshes updatedAt). */
  saveOrderDraft(draft: OrderDraft): void {
    draft.updatedAt = Date.now();
    store.set(sessionKey(draft.telegramUserId, draft.chatId), draft);
  },

  /** Cancel and discard the active draft. */
  clearOrderDraft(telegramUserId: string, chatId: string): void {
    store.delete(sessionKey(telegramUserId, chatId));
  },

  /** Purge all expired sessions (called periodically). Returns count purged. */
  purgeExpired(): number {
    const now = Date.now();
    let purged = 0;
    for (const [key, draft] of store.entries()) {
      if (now - draft.updatedAt > SESSION_TTL_MS) {
        store.delete(key);
        purged++;
      }
    }
    return purged;
  },

  /** Active session count (for debugging / monitoring). */
  activeCount(): number {
    return store.size;
  },
};
