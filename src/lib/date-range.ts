// Date-range helpers used by dashboard & reports.

export type Preset = "today" | "yesterday" | "this_week" | "last_week" | "this_month" | "last_month" | "this_year" | "custom";

export function resolveRange(preset?: string, fromStr?: string, toStr?: string, tz = "Asia/Dhaka"): { from?: Date; to?: Date } {
  const now = new Date();
  const startOfDay = (d: Date) => {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
  };
  const endOfDay = (d: Date) => {
    const x = new Date(d);
    x.setHours(23, 59, 59, 999);
    return x;
  };

  if (fromStr && toStr) {
    return { from: startOfDay(new Date(fromStr)), to: endOfDay(new Date(toStr)) };
  }

  switch (preset as Preset | undefined) {
    case "today":
      return { from: startOfDay(now), to: endOfDay(now) };
    case "yesterday": {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      return { from: startOfDay(y), to: endOfDay(y) };
    }
    case "this_week": {
      const from = new Date(now);
      const day = (from.getDay() + 6) % 7; // Mon=0
      from.setDate(from.getDate() - day);
      return { from: startOfDay(from), to: endOfDay(now) };
    }
    case "last_week": {
      const start = new Date(now);
      const day = (start.getDay() + 6) % 7;
      start.setDate(start.getDate() - day - 7);
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      return { from: startOfDay(start), to: endOfDay(end) };
    }
    case "this_month":
      return { from: startOfDay(new Date(now.getFullYear(), now.getMonth(), 1)), to: endOfDay(now) };
    case "last_month": {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      return { from: startOfDay(start), to: endOfDay(end) };
    }
    case "this_year":
      return { from: startOfDay(new Date(now.getFullYear(), 0, 1)), to: endOfDay(now) };
    default:
      if (fromStr) return { from: startOfDay(new Date(fromStr)), to: endOfDay(now) };
      // default: last 30 days
      const from = new Date(now);
      from.setDate(from.getDate() - 29);
      return { from: startOfDay(from), to: endOfDay(now) };
  }
}

export function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleString("en-GB", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDateShort(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "2-digit" });
}
