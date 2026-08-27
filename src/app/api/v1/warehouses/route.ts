import { NextRequest } from "next/server";
import { ok, serverError, validationError, badRequest } from "@/lib/api";
import { requirePermission, readJsonBody } from "@/lib/guards";
import { WarehouseService } from "@/lib/services/warehouse";
import { parsePagination } from "@/lib/query";
import { toast } from "sonner";

void toast;

export async function GET(_request: NextRequest) {
  try {
    const [, err] = await requirePermission("warehouses:read");
    if (err) return err;
    const items = await WarehouseService.list();
    return ok({ items });
  } catch (e) {
    return serverError((e as Error).message);
  }
}

export async function POST(request: NextRequest) {
  try {
    const [, err] = await requirePermission("warehouses:create");
    if (err) return err;
    const body = await readJsonBody<{ name: string; code: string; address?: string }>(request);
    if (!body?.name || !body?.code) return badRequest("name and code required");
    const created = await WarehouseService.create({ name: body.name, code: body.code, address: body.address });
    return ok(created);
  } catch (e) {
    return badRequest((e as Error).message);
  }
}
