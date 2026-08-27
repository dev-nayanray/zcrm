import { NextRequest } from "next/server";
import { ok, serverError, badRequest } from "@/lib/api";
import { requirePermission, readJsonBody } from "@/lib/guards";
import { ConversationService } from "@/lib/services/conversation";
import { WhatsAppService } from "@/lib/services/whatsapp";
import { getCurrentUser } from "@/lib/auth";
import { parsePagination } from "@/lib/query";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, ctx: Ctx) {
  try {
    const [, err] = await requirePermission("conversations:read");
    if (err) return err;
    const { id } = await ctx.params;
    const q = parsePagination(request.nextUrl.searchParams);
    const res = await ConversationService.messages(id, { page: q.page, limit: 200 });
    return ok(res);
  } catch (e) {
    return serverError((e as Error).message);
  }
}

export async function POST(request: NextRequest, ctx: Ctx) {
  // Send a message. If the conversation is WhatsApp + has a connection, send via Cloud API.
  try {
    const [, err] = await requirePermission("messages:send");
    if (err) return err;
    const { id } = await ctx.params;
    const user = await getCurrentUser();
    const body = await readJsonBody<{ body: string; templateId?: string; connectionId?: string }>(request);
    if (!body?.body) return badRequest("body required");
    const conv = await ConversationService.get(id);
    if (!conv) return badRequest("Conversation not found");

    if (conv.provider === "whatsapp" && (body.connectionId || conv.providerConnectionId)) {
      const connId = body.connectionId ?? conv.providerConnectionId!;
      const to = conv.contactPhone ?? conv.customer?.phone ?? "";
      if (!to) return badRequest("Conversation has no phone number to send to");
      const result = await WhatsAppService.sendMessage({
        connectionId: connId, conversationId: id, to, body: body.body, templateId: body.templateId, sentBy: user?.id,
      });
      return ok(result);
    }
    // Fallback (messenger/email/future): just persist the outgoing message
    const msg = await ConversationService.appendMessage({
      conversationId: id, direction: "OUTGOING", provider: conv.provider, body: body.body, templateId: body.templateId, status: "SENT", sentBy: user?.id,
    });
    return ok(msg);
  } catch (e) {
    return badRequest((e as Error).message);
  }
}
