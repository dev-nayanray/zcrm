import { NextRequest } from "next/server";
import { ok, serverError, forbidden } from "@/lib/api";
import { requirePermission, readJsonBody } from "@/lib/guards";
import { AuditService } from "@/lib/services/audit";
import { parsePagination } from "@/lib/query";
import { getCurrentUser } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const [, err] = await requirePermission("audit_logs:read");
    if (err) return err;
    const q = parsePagination(request.nextUrl.searchParams);
    const entity = request.nextUrl.searchParams.get("entity") || undefined;
    const action = request.nextUrl.searchParams.get("action") || undefined;
    const userId = request.nextUrl.searchParams.get("userId") || undefined;
    const source = request.nextUrl.searchParams.get("source") || undefined;
    const { items, total } = await AuditService.list({ page: q.page, limit: q.limit, search: q.search, entity, action, userId, source });
    return ok({
      items: items.map((i) => ({ ...i, changes: i.changes ? (() => { try { return JSON.parse(i.changes); } catch { return i.changes; } })() : null })),
      total,
      page: q.page,
      limit: q.limit,
    });
  } catch (e) {
    return serverError((e as Error).message);
  }
}

// Manual audit log creation is gated behind audit_logs:read (admins only) and
// NEVER trusts client-supplied userId/ipAddress — these are always derived
// from the authenticated session. This prevents audit-log forgery where a
// low-privilege user could post fake audit entries attributed to another user.
export async function POST(request: NextRequest) {
  try {
    const [user, err] = await requirePermission("audit_logs:read");
    if (err) return err;
    const body = await readJsonBody<{ action: string; entity: string; entityId?: string; changes?: unknown }>(request);
    if (!body?.action || !body?.entity) {
      return forbidden("action and entity are required");
    }
    // Build the log payload explicitly — do NOT spread the body, so callers
    // cannot override userId / ipAddress / any other protected field.
    await AuditService.log({
      userId: user.id,
      action: body.action,
      entity: body.entity,
      entityId: body.entityId,
      changes: body.changes,
    });
    return ok({ success: true });
  } catch (e) {
    return serverError((e as Error).message);
  }
}
