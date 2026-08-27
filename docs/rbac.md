# Role-Based Access Control (RBAC)

**RBAC is enforced on the backend. Hiding buttons in the frontend is NOT sufficient.**

## Roles

| Role | Intended user | Scope |
|---|---|---|
| `SUPER_ADMIN` | Platform owner | Everything (also bypasses checks in code) |
| `ADMIN` | Business owner | Everything |
| `MANAGER` | Store manager | Orders, customers, products, inventory, purchases, payments, returns, reports |
| `SALES` | Sales officer | Customers, orders (create/update/cancel), payments, returns |
| `INVENTORY` | Inventory officer | Products, categories, suppliers, inventory, purchases |
| `ACCOUNTANT` | Accountant | Payments (+refund), expenses (CRUD), refunds, reports, read-only orders/customers/purchases |

## Permission catalog (52 granular permissions)

```
dashboard:read

orders:read, orders:create, orders:update, orders:delete, orders:cancel
customers:read, customers:create, customers:update, customers:delete
products:read, products:create, products:update, products:delete
categories:read, categories:create, categories:update, categories:delete
suppliers:read, suppliers:create, suppliers:update, suppliers:delete
inventory:read, inventory:adjust
purchases:read, purchases:create, purchases:update
payments:read, payments:create, payments:refund
expenses:read, expenses:create, expenses:update, expenses:delete
returns:read, returns:create, returns:update
refunds:read, refunds:create
reports:read, exports:read
users:read, users:create, users:update, users:delete
roles:read, roles:create, roles:update, roles:delete
settings:read, settings:update
audit_logs:read
integrations:read, integrations:update, integrations:sync
notifications:read
```

## Role → permission matrix

See `ROLE_PERMISSIONS` in `src/lib/constants.ts`. `SUPER_ADMIN` and `ADMIN` resolve to the full set. The `/api/v1/auth/me` endpoint returns the resolved permission list for the current user so the UI can hide controls.

## Enforcement

```ts
// src/lib/guards.ts
export async function requirePermission(permission: Permission) {
  const [user, authErr] = await requireAuth();       // 401 if no session
  if (authErr) return [null, authErr];
  if (!hasPermission(user!, permission)) return [null, forbidden()];  // 403
  return [user!, null];
}
```

`hasPermission` checks the role name: SUPER_ADMIN/ADMIN always pass; otherwise the permission must be in `ROLE_PERMISSIONS[roleName]`.

## Custom roles

Non-system roles can be created (`POST /api/v1/roles`) and assigned any subset of the permission catalog via `PATCH /api/v1/roles/:id`. System roles (`isSystem: true`) cannot have their permissions changed.
