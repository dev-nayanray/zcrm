import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, serverError } from "@/lib/api";
import { requirePermission } from "@/lib/guards";

export async function GET(_request: NextRequest) {
  try {
    const [, err] = await requirePermission("expenses:read");
    if (err) return err;
    const items = await db.expenseCategory.findMany({ orderBy: { name: "asc" } });
    return ok({ items });
  } catch (e) {
    return serverError((e as Error).message);
  }
}
