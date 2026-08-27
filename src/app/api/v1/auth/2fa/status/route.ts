import { requireAuth } from "@/lib/guards";
import { ok, serverError } from "@/lib/api";
import { TwoFactorService } from "@/lib/services/two-factor";

export async function GET() {
  try {
    const [user, err] = await requireAuth();
    if (err) return err;
    return ok(await TwoFactorService.status(user!.id));
  } catch (e) {
    return serverError((e as Error).message);
  }
}
