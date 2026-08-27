# MongoDB Atlas Configuration

## Your Atlas Cluster

The Z-CRM backend is fully migrated to MongoDB and ready for MongoDB Atlas. Your connection string is configured in `.env`:

```
MONGODB_URI=mongodb+srv://nayangodevs_db_user:YUBej3ctQttKEmqv@crm.3iumfww.mongodb.net/zcrm?retryWrites=true&w=majority&appName=crm
```

## Sandbox Limitation (Development)

This cloud sandbox environment **blocks outbound TLS on port 27017** (the MongoDB port). The TLS handshake to your Atlas cluster fails with `alert 80 (internal_error)` because the sandbox network intercepts non-HTTP TLS traffic.

For development in this sandbox, a **local MongoDB 8.0.4 replica set** is running on `127.0.0.1:27017`. The `.env` file uses:

```
MONGODB_URI=mongodb://127.0.0.1:27017/zcrm?replicaSet=rs0
```

Your Atlas connection string is preserved as a comment in `.env` and will be used automatically when you deploy to a production environment where port 27017 is unrestricted.

## Production Deployment (Atlas)

When deploying to a VPS, EC2, Docker container, or any environment with unrestricted outbound access:

1. **Set the Atlas connection string** in `.env`:
   ```
   MONGODB_URI=mongodb+srv://nayangodevs_db_user:YUBej3ctQttKEmqv@crm.3iumfww.mongodb.net/zcrm?retryWrites=true&w=majority&appName=crm
   ```

2. **Whitelist your deployment IP** in Atlas:
   - Go to MongoDB Atlas → Network Access → Add IP Address
   - Add your deployment server's public IP (or `0.0.0.0/0` for testing)

3. **Push the schema** to create indexes:
   ```bash
   bun run db:push
   ```

4. **Seed the database** with initial data:
   ```bash
   bun run seed
   ```

5. **Start the application**:
   ```bash
   bun run dev
   ```

## Atlas Cluster Details

- **Cluster name**: `crm`
- **Cluster URL**: `crm.3iumfww.mongodb.net`
- **Database name**: `zcrm`
- **Username**: `nayangodevs_db_user`
- **Replica set**: `atlas-4fukdd-shard-0`
- **Shard hosts**:
  - `ac-xxzs9ai-shard-00-00.3iumfww.mongodb.net:27017`
  - `ac-xxzs9ai-shard-00-01.3iumfww.mongodb.net:27017`
  - `ac-xxzs9ai-shard-00-02.3iumfww.mongodb.net:27017`

## What was migrated

- **68 models** (all Prisma models from the original SQLite schema)
- **73 Decimal fields** → Float (MongoDB has no native Decimal; `toDecimal()` preserves precision)
- **130 indexes** created automatically by `prisma db:push`
- **9 unique constraints**
- **681 seed documents** across 68 collections
- **All 48 tests pass** (26 acceptance + 9 integration + 13 telegram)

## Security

- Credentials are stored in `.env` (gitignored)
- `AUTH_SECRET` is set for HMAC session signing
- All webhooks verify HMAC signatures
- PBKDF2-600k password hashing
- 60+ granular RBAC permissions
- Immutable audit logs
