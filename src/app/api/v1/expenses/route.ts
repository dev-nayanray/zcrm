import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { ok, serverError, validationError, badRequest } from "@/lib/api";
import { requirePermission, readJsonBody } from "@/lib/guards";
import { createExpenseSchema } from "@/lib/validation";
import { AuditService } from "@/lib/services/audit";
import { parsePagination } from "@/lib/query";

export async function GET(request: NextRequest) {
  try {
    const [, err] = await requirePermission("expenses:read");
    if (err) return err;
    const q = parsePagination(request.nextUrl.searchParams);
    const categoryId = request.nextUrl.searchParams.get("categoryId") || undefined;
    const from = request.nextUrl.searchParams.get("from");
    const to = request.nextUrl.searchParams.get("to");
    const where: Prisma.ExpenseWhereInput = {};
    if (q.search) where.description = { contains: q.search };
    if (categoryId) where.categoryId = categoryId;
    if (from || to) {
      const expenseDate: Record<string, Date> = {};
      if (from) expenseDate.gte = new Date(from);
      if (to) expenseDate.lte = new Date(to);
      where.expenseDate = expenseDate;
    }
    const [items, total] = await Promise.all([
      db.expense.findMany({
        where,
        orderBy: { expenseDate: "desc" },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
        include: {
          category: true,
          creator: { select: { id: true, name: true } },
        },
      }),
      db.expense.count({ where }),
    ]);
    return ok({
      items: items.map((e) => ({
        ...e,
        amount: e.amount.toFixed(2),
      })),
      total,
      page: q.page,
      limit: q.limit,
    });
  } catch (e) {
    return serverError((e as Error).message);
  }
}

export async function POST(request: NextRequest) {
  try {
    const [user, err] = await requirePermission("expenses:create");
    if (err) return err;
    const body = await readJsonBody(request);
    const parsed = createExpenseSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);
    const data = parsed.data;
    const expense = await db.expense.create({
      data: {
        categoryId: data.categoryId,
        amount: data.amount,
        paymentMethod: data.paymentMethod,
        description: data.description,
        reference: data.reference,
        expenseDate: data.expenseDate ? new Date(data.expenseDate) : new Date(),
        createdBy: user!.id,
      },
      include: { category: true },
    });
    await AuditService.log({ userId: user!.id, action: "EXPENSE_CREATE", entity: "Expense", entityId: expense.id, changes: { amount: data.amount } });
    return ok({ ...expense, amount: expense.amount.toFixed(2) });
  } catch (e) {
    return serverError((e as Error).message);
  }
}

void badRequest;
