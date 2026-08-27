import { NextRequest } from "next/server";
import { ok, serverError, validationError, badRequest } from "@/lib/api";
import { requirePermission, readJsonBody } from "@/lib/guards";
import { MessageTemplateService } from "@/lib/services/message-template";

export async function GET(request: NextRequest) {
  try {
    const [, err] = await requirePermission("message_templates:read");
    if (err) return err;
    const channel = request.nextUrl.searchParams.get("channel") || undefined;
    const status = request.nextUrl.searchParams.get("status") || undefined;
    const items = await MessageTemplateService.list({ channel, status });
    return ok({ items: items.map((t: any) => ({ ...t, variables: t.variables ? JSON.parse(t.variables) : [] })) });
  } catch (e) {
    return serverError((e as Error).message);
  }
}

export async function POST(request: NextRequest) {
  try {
    const [, err] = await requirePermission("message_templates:create");
    if (err) return err;
    const body = await readJsonBody<{ name: string; channel: string; category?: string; language?: string; subject?: string; body: string; isApproved?: boolean; externalId?: string }>(request);
    if (!body?.name || !body?.channel || !body?.body) return badRequest("name, channel and body required");
    try {
      const t = await MessageTemplateService.create(body);
      return ok({ ...t, variables: t.variables ? JSON.parse(t.variables) : [] });
    } catch (e) {
      return badRequest((e as Error).message);
    }
  } catch (e) {
    return serverError((e as Error).message);
  }
}

void validationError;
