import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, serverError, validationError, notFound } from "@/lib/api";
import { requirePermission, readJsonBody } from "@/lib/guards";
import { updateExpenseSchema } from "@/lib/validation";
import { AuditService } from "@/lib/services/audit";

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, ctx: Ctx) {
  try {
    const [user, err] = await requirePermission("expenses:update");
    if (err) return err;
    const { id } = await ctx.params;
    const body = await readJsonBody(request);
    const parsed = updateExpenseSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);
    const existing = await db.expense.findUnique({ where: { id } });
    if (!existing) return notFound("Expense not found");
    const data: Record<string, unknown> = { ...parsed.data };
    if (parsed.data.expenseDate) data.expenseDate = new Date(parsed.data.expenseDate);
    const updated = await db.expense.update({ where: { id }, data });
    await AuditService.log({ userId: user!.id, action: "EXPENSE_UPDATE", entity: "Expense", entityId: id, changes: parsed.data });
    return ok({ ...updated, amount: updated.amount.toFixed(2) });
  } catch (e) {
    return serverError((e as Error).message);
  }
}

export async function DELETE(_request: NextRequest, ctx: Ctx) {
  try {
    const [user, err] = await requirePermission("expenses:delete");
    if (err) return err;
    const { id } = await ctx.params;
    const existing = await db.expense.findUnique({ where: { id } });
    if (!existing) return notFound("Expense not found");
    await db.expense.delete({ where: { id } });
    await AuditService.log({ userId: user!.id, action: "EXPENSE_DELETE", entity: "Expense", entityId: id });
    return ok({ success: true });
  } catch (e) {
    return serverError((e as Error).message);
  }
}
