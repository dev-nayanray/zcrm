# Z-CRM — Local Setup Guide

## Quick Start (3 commands)

```bash
# 1. Install dependencies
bun install

# 2. Push schema to MongoDB Atlas & seed initial data
bun run db:push
bun run seed

# 3. Start the dev server
bun run dev
```

Open **http://localhost:3000** in your browser.

---

## What's Included

This ZIP contains the complete Z-CRM omnichannel business management suite:

- **Frontend**: Next.js 16 + TypeScript + Tailwind CSS + shadcn/ui + Framer Motion
- **Backend**: Next.js API Routes (100+ endpoints) + Prisma ORM
- **Database**: MongoDB Atlas (connection string in `.env.example`)
- **Auth**: Cookie-based HMAC-SHA256 sessions, PBKDF2-600k password hashing
- **Tests**: 48 tests (acceptance + integration + telegram)

## Demo Login Credentials

| Role | Email | Password |
|------|-------|----------|
| Super Admin | superadmin@zcrm.local | Admin@123 |
| Admin | admin@zcrm.local | Admin@123 |
| Manager | manager@zcrm.local | Manager@123 |
| Sales | sales@zcrm.local | Sales@123 |
| Inventory | inventory@zcrm.local | Stock@123 |
| Accountant | accounts@zcrm.local | Accts@123 |

---

## Step-by-Step Setup

### 1. Install Node.js & Bun

```bash
# Install Bun (the JavaScript runtime)
curl -fsSL https://bun.sh/install | bash
source ~/.bashrc
```

### 2. Install Dependencies

```bash
cd z-crm
bun install
```

### 3. Configure Environment

```bash
# Copy the example env file
cp .env.example .env

# The .env already has your MongoDB Atlas connection string:
# MONGODB_URI=mongodb+srv://nayangodevs_db_user:YUBej3ctQttKEmqv@crm.3iumfww.mongodb.net/zcrm?retryWrites=true&w=majority&appName=crm
```

### 4. Initialize MongoDB Atlas

Make sure your IP is whitelisted in Atlas:
1. Go to https://cloud.mongodb.com → Network Access → Add IP Address
2. Add your current IP (or `0.0.0.0/0` for anywhere)

Then push the schema and seed:

```bash
# Creates all 68 collections + 130 indexes on Atlas
bun run db:push

# Seeds 6 roles, 6 users, 12 products, 12 customers, 22 orders, etc.
bun run seed
```

### 5. Start the App

```bash
bun run dev
```

Open http://localhost:3000 — you'll see the landing page.

Click **"Sign in"** → use the demo credentials above.

---

## Project Structure

```
z-crm/
├── src/
│   ├── app/
│   │   ├── (site)/          # Public website pages (58 pages)
│   │   ├── api/v1/          # REST API (100+ routes)
│   │   ├── app/             # CRM shell (login + dashboard)
│   │   ├── register/        # Registration page
│   │   ├── forgot-password/
│   │   ├── reset-password/
│   │   ├── verify-email/
│   │   └── onboarding/
│   ├── components/
│   │   ├── crm/             # CRM app components (views, shell, kanban)
│   │   ├── site/            # Public site components (header, footer, etc.)
│   │   └── ui/              # shadcn/ui primitives
│   └── lib/
│       ├── services/        # Business logic (OrderService, InventoryService, etc.)
│       ├── constants.ts     # RBAC permissions, roles, enums
│       ├── validation.ts    # Zod schemas
│       └── db.ts            # Prisma client
├── prisma/
│   ├── schema.prisma        # MongoDB schema (68 models)
│   └── seed.ts              # Database seeder
├── tests/                   # 48 integration tests
└── .env.example             # Your Atlas connection string
```

## Key Features

### CRM Modules (18)
Orders, Customers, Inventory, Products, Purchases, Suppliers, Deliveries, Payments, Expenses, Returns, Leads, Sales Pipeline, Kanban, Automation, Notifications, Cash Register, Reports, Audit Logs

### Integrations
- **WooCommerce** — order/product/customer sync via HMAC-signed webhooks
- **WhatsApp Business Cloud API** — omnichannel inbox + outbound templates
- **Meta/Facebook** — Lead Ads auto-import + Messenger
- **Telegram Bot** — 20+ commands, group-based RBAC, English + Bangla
- **Couriers** — Pathao, Steadfast, RedX
- **Payments** — bKash, Nagad, Cash, Bank, Card, Wallet

### Security
- HMAC-SHA256 signed session cookies
- PBKDF2-600k password hashing (OWASP 2023)
- 60+ granular RBAC permissions across 6 roles
- Immutable audit logs (every mutation logged)
- All webhooks verify HMAC signatures
- Rate limiting on login & registration
- Last-super-admin guard
- CSV formula injection protection

---

## Commands

| Command | Description |
|---------|-------------|
| `bun run dev` | Start dev server on port 3000 |
| `bun run lint` | Run ESLint |
| `bun run db:push` | Push schema to MongoDB Atlas (creates indexes) |
| `bun run db:generate` | Regenerate Prisma Client |
| `bun run seed` | Seed initial data (roles, users, products, etc.) |
| `bun test` | Run 48 integration tests |

---

## Troubleshooting

### "Server selection timeout: No available servers"
→ Your IP is not whitelisted in MongoDB Atlas. Go to Network Access → Add IP.

### "Authentication failed"
→ Check that the username and password in `.env` match your Atlas database user.

### "Port 27017 connection refused"
→ Your local firewall or network may block outbound port 27017. MongoDB Atlas requires this port.

### "Cannot find module '@prisma/client'"
→ Run `bun run db:generate` to generate the Prisma client.

---

## Need Help?

- 📧 Email: support@z-crm.app
- 📖 Full docs: `docs/` folder
- 🐛 Run tests: `bun test`
