# WooCommerce Integration

The CRM remains **independent from WordPress** — it is not a WordPress plugin. It pulls/pushes data via the WooCommerce REST API and receives real-time updates via webhooks.

## Configuration

In the CRM UI: **Integrations → WooCommerce**. Fields:

| Field | Purpose |
|---|---|
| WordPress URL | e.g. `https://yourstore.com` |
| Consumer Key | `ck_…` (WooCommerce → Settings → API → Keys/Apps) |
| Consumer Secret | `cs_…` — **stored in DB, never returned to the client** (the GET endpoint masks it) |
| Webhook Secret | optional, used to verify webhook signatures |

Stored as JSON in the `Integration.config` column (name = "woocommerce").

## Bulk sync

- `POST /api/v1/integrations/woocommerce/sync?entity=products` — pulls up to 3 pages of products and upserts each via `syncProduct`.
- `POST /api/v1/integrations/woocommerce/sync?entity=orders` — pulls up to 3 pages of orders and upserts each via `syncOrder`.

Each synced record creates/updates a `SyncLog` row.

## Webhooks (real-time)

**Endpoint:** `POST /api/v1/integrations/woocommerce/webhook`

### Signature verification

If a `webhookSecret` is configured, the receiver recomputes `HMAC-SHA256(rawBody, webhookSecret)` and compares it (base64) to the `X-WC-Webhook-Signature` header. Mismatch → `401 Unauthorized`.

### Idempotency (CRITICAL)

Webhook processing is **idempotent** — if WooCommerce sends the same webhook multiple times, the CRM does **not** create duplicate records:

- **Products / customers:** `syncProduct`/`syncCustomer` look up by `externalId` first; existing records are updated, new ones are created.
- **Orders:** `syncOrder` checks `Order.externalId` first; if found, it logs "Already synced" and returns the existing order — no duplicate, no double stock deduction.
- **SyncLog:** upserted on the unique key `(entity, externalId, operation)` so retries update the same row (incrementing `attemptCount`) instead of creating duplicates.

### Supported topics

Configure these in WooCommerce → Settings → API → Webhooks:

- `order.created`, `order.updated`, `order.deleted`
- `product.created`, `product.updated`, `product.deleted`
- `customer.created`, `customer.updated`, `customer.deleted`

The webhook URL to register:

```
https://<your-crm-domain>/api/v1/integrations/woocommerce/webhook
```

## Retry

`SyncLog.status` is `PENDING` / `SUCCESS` / `FAILED`. Failed syncs increment `attemptCount`. Bulk sync re-attempts failed records on the next run. (A dedicated background retry worker can be added later by polling `SyncLog where status=FAILED`.)

## Audit

Every manual sync and every webhook delivery writes an `AuditLog` (`action = WOOCOMMERCE_SYNC`).
