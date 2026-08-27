import { NextRequest } from "next/server";
import { ok, serverError, notFound, badRequest } from "@/lib/api";
import { requirePermission, readJsonBody } from "@/lib/guards";
import { ConversationService } from "@/lib/services/conversation";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, ctx: Ctx) {
  try {
    const [, err] = await requirePermission("conversations:read");
    if (err) return err;
    const { id } = await ctx.params;
    const conv = await ConversationService.get(id);
    if (!conv) return notFound("Conversation not found");
    await ConversationService.markRead(id);
    return ok({ ...conv, orders: conv.orders.map((o: any) => ({ ...o, total: o.total.toFixed(2) })) });
  } catch (e) {
    return serverError((e as Error).message);
  }
}

export async function PATCH(request: NextRequest, ctx: Ctx) {
  try {
    const [, err] = await requirePermission("conversations:update");
    if (err) return err;
    const { id } = await ctx.params;
    const body = await readJsonBody<{ status?: string; assignedUserId?: string; customerId?: string }>(request);
    if (body?.assignedUserId) await ConversationService.assign(id, body.assignedUserId);
    if (body?.status) await ConversationService.setStatus(id, body.status);
    if (body?.customerId) await ConversationService.linkCustomer(id, body.customerId);
    const updated = await ConversationService.get(id);
    return ok(updated);
  } catch (e) {
    return badRequest((e as Error).message);
  }
}
