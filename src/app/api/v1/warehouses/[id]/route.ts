import { NextRequest } from "next/server";
import { ok, serverError, validationError, notFound, badRequest } from "@/lib/api";
import { requirePermission, readJsonBody } from "@/lib/guards";
import { WarehouseService } from "@/lib/services/warehouse";

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, ctx: Ctx) {
  try {
    const [, err] = await requirePermission("warehouses:update");
    if (err) return err;
    const { id } = await ctx.params;
    const body = await readJsonBody<{ name?: string; address?: string; isActive?: boolean }>(request);
    const updated = await WarehouseService.update(id, body ?? {});
    return ok(updated);
  } catch (e) {
    return badRequest((e as Error).message);
  }
}

export async function DELETE(_request: NextRequest, ctx: Ctx) {
  try {
    const [, err] = await requirePermission("warehouses:delete");
    if (err) return err;
    const { id } = await ctx.params;
    await WarehouseService.del(id);
    return ok({ success: true });
  } catch (e) {
    return badRequest((e as Error).message);
  }
}

void validationError; void notFound; void serverError;
