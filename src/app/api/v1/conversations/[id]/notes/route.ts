import { NextRequest } from "next/server";
import { ok, serverError, badRequest } from "@/lib/api";
import { requirePermission, readJsonBody } from "@/lib/guards";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, ctx: Ctx) {
  try {
    const [, err] = await requirePermission("conversations:read");
    if (err) return err;
    const { id } = await ctx.params;
    const notes = await db.conversationNote.findMany({ where: { conversationId: id }, orderBy: { createdAt: "desc" }, include: {} });
    return ok({ items: notes });
  } catch (e) { return serverError((e as Error).message); }
}

export async function POST(request: NextRequest, ctx: Ctx) {
  try {
    const [user, err] = await requirePermission("conversations:update");
    if (err) return err;
    const { id } = await ctx.params;
    const body = await readJsonBody<{ body: string }>(request);
    if (!body?.body) return badRequest("body required");
    return ok(await db.conversationNote.create({ data: { conversationId: id, body: body.body, createdBy: user?.id } }));
  } catch (e) { return badRequest((e as Error).message); }
}
