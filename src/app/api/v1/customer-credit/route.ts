import { NextRequest } from "next/server";
import { ok, serverError, badRequest, validationError, notFound } from "@/lib/api";
import { requirePermission, readJsonBody } from "@/lib/guards";
import { CustomerDueService } from "@/lib/services/customer-due";
import { z } from "zod";
import { db } from "@/lib/db";

const customerCreditActionSchema = z.object({
  customerId: z.string().min(1, "customerId required"),
  action: z.enum(["advance", "limit"]),
  amount: z
    .union([z.string(), z.number()])
    .transform((v) => (v === "" || v === null ? "0" : String(v)))
    .refine((v) => !isNaN(Number(v)) && Number(v) >= 0, "Amount must be non-negative"),
  notes: z.string().max(2000).optional(),
}).refine(
  (v) => v.action !== "advance" || Number(v.amount) > 0,
  { message: "Advance amount must be greater than zero", path: ["amount"] },
);

export async function POST(request: NextRequest) {
  try {
    const [, err] = await requirePermission("payments:create");
    if (err) return err;
    const body = await readJsonBody(request);
    const parsed = customerCreditActionSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);
    // Verify the customer exists for a clean 404 instead of a generic 500.
    const customer = await db.customer.findUnique({ where: { id: parsed.data.customerId } });
    if (!customer) return notFound("Customer not found");
    if (parsed.data.action === "advance") {
      return ok(await CustomerDueService.recordAdvance(parsed.data.customerId, parsed.data.amount, parsed.data.notes));
    }
    return ok(await CustomerDueService.setCreditLimit(parsed.data.customerId, parsed.data.amount));
  } catch (e) { return badRequest((e as Error).message); }
}
