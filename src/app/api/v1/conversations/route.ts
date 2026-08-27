import { NextRequest } from "next/server";
import { ok, serverError, badRequest, validationError } from "@/lib/api";
import { requirePermission, readJsonBody } from "@/lib/guards";
import { ConversationService } from "@/lib/services/conversation";
import { parsePagination } from "@/lib/query";

export async function GET(request: NextRequest) {
  try {
    const [, err] = await requirePermission("conversations:read");
    if (err) return err;
    const q = parsePagination(request.nextUrl.searchParams);
    const provider = request.nextUrl.searchParams.get("provider") || undefined;
    const status = request.nextUrl.searchParams.get("status") || undefined;
    const assignedUserId = request.nextUrl.searchParams.get("assignedUserId") || undefined;
    const search = q.search;
    const res = await ConversationService.list({ page: q.page, limit: q.limit, provider, status, assignedUserId, search });
    return ok({ items: res.items, total: res.total, page: q.page, limit: q.limit });
  } catch (e) {
    return serverError((e as Error).message);
  }
}

export async function POST(request: NextRequest) {
  // Manually start a conversation with a customer (e.g. outbound WhatsApp)
  try {
    const [, err] = await requirePermission("conversations:create");
    if (err) return err;
    const body = await readJsonBody<{ provider: string; customerId?: string; contactName?: string; contactPhone?: string; channelId?: string; message?: string }>(request);
    if (!body?.provider || (!body.customerId && !body.contactPhone)) return badRequest("provider and (customerId or contactPhone) required");
    const conv = await ConversationService.upsertByExternal({
      provider: body.provider,
      externalConversationId: body.contactPhone ?? body.customerId!,
      contactName: body.contactName,
      contactPhone: body.contactPhone,
      channelId: body.channelId,
      lastMessagePreview: body.message,
    });
    if (body.customerId) await ConversationService.linkCustomer(conv.id, body.customerId);
    if (body.message) await ConversationService.appendMessage({ conversationId: conv.id, direction: "OUTGOING", provider: body.provider, body: body.message, status: "SENT" });
    return ok(conv);
  } catch (e) {
    return serverError((e as Error).message);
  }
}

void validationError;
