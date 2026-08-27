import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, serverError, badRequest } from "@/lib/api";
import { requirePermission, readJsonBody } from "@/lib/guards";

export async function GET(_request: NextRequest) {
  try {
    const [, err] = await requirePermission("orders:read");
    if (err) return err;
    const items = await db.channel.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { orders: true } } } });
    return ok({ items });
  } catch (e) {
    return serverError((e as Error).message);
  }
}

export async function POST(request: NextRequest) {
  try {
    const [, err] = await requirePermission("settings:update");
    if (err) return err;
    const body = await readJsonBody<{ name: string }>(request);
    if (!body?.name) return badRequest("Name required");
    const existing = await db.channel.findUnique({ where: { name: body.name } });
    if (existing) return badRequest("Channel already exists");
    const created = await db.channel.create({ data: { name: body.name } });
    return ok(created);
  } catch (e) {
    return serverError((e as Error).message);
  }
}
