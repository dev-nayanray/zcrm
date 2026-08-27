import { NextRequest, NextResponse } from "next/server";
import { ok, serverError, badRequest } from "@/lib/api";
import { requirePermission, readJsonBody } from "@/lib/guards";
import { db } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, ctx: Ctx) {
  try {
    const [, err] = await requirePermission("conversations:read");
    if (err) return err;
    const { id } = await ctx.params;
    const tags = await db.conversationTag.findMany({ where: { conversationId: id } });
    return ok({ items: tags });
  } catch (e) { return serverError((e as Error).message); }
}

export async function POST(request: NextRequest, ctx: Ctx) {
  try {
    const [, err] = await requirePermission("conversations:update");
    if (err) return err;
    const { id } = await ctx.params;
    const body = await readJsonBody<{ tag: string }>(request);
    if (!body?.tag) return badRequest("tag required");
    return ok(await db.conversationTag.upsert({ where: { conversationId_tag: { conversationId: id, tag: body.tag } }, create: { conversationId: id, tag: body.tag }, update: {} }));
  } catch (e) { return badRequest((e as Error).message); }
}

export async function DELETE(request: NextRequest, ctx: Ctx) {
  try {
    const [, err] = await requirePermission("conversations:update");
    if (err) return err;
    const { id } = await ctx.params;
    const tag = request.nextUrl.searchParams.get("tag");
    if (!tag) return badRequest("tag query param required");
    await db.conversationTag.deleteMany({ where: { conversationId: id, tag } });
    return ok({ success: true });
  } catch (e) { return badRequest((e as Error).message); }
}
