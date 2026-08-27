import { NextRequest } from "next/server";
import { ok, serverError, badRequest } from "@/lib/api";
import { requirePermission, readJsonBody } from "@/lib/guards";
import { WhatsAppService } from "@/lib/services/whatsapp";
import { getCurrentUser } from "@/lib/auth";

// Send a WhatsApp message to a phone number (not tied to a conversation yet).
export async function POST(request: NextRequest) {
  try {
    const [, err] = await requirePermission("messages:send");
    if (err) return err;
    const user = await getCurrentUser();
    const body = await readJsonBody<{ connectionId: string; to: string; body: string; conversationId?: string; templateId?: string }>(request);
    if (!body?.connectionId || !body?.to || !body?.body) return badRequest("connectionId, to and body required");
    const result = await WhatsAppService.sendMessage({
      connectionId: body.connectionId,
      conversationId: body.conversationId ?? "",
      to: body.to,
      body: body.body,
      templateId: body.templateId,
      sentBy: user?.id,
    });
    return ok(result);
  } catch (e) {
    return badRequest((e as Error).message);
  }
}
