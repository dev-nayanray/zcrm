// Helpers for parsing query strings and producing CSV exports.

export function parsePagination(searchParams: URLSearchParams) {
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
  const limit = Math.min(200, Math.max(1, parseInt(searchParams.get("limit") || "20", 10) || 20));
  const search = searchParams.get("search") || undefined;
  const sort = searchParams.get("sort") || undefined;
  const order = (searchParams.get("order") === "asc" ? "asc" : "desc") as "asc" | "desc";
  return { page, limit, search, sort, order };
}

// Convert array of rows to CSV. First row is the header (object keys).
//
// SECURITY: cells starting with =, +, -, @, \t, \r are prefixed with a
// single quote to prevent formula injection when the CSV is opened in
// Excel/Google Sheets. Without this, a customer named `=cmd|"/c calc"!A1`
// would execute a command on the analyst's machine when they open the
// export.
export function toCSV(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "";
  const headers = Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
  const escape = (val: unknown) => {
    if (val === null || val === undefined) return "";
    const s = typeof val === "object" ? JSON.stringify(val) : String(val);
    // Formula-injection guard: if the cell starts with a character that
    // Excel/Sheets treat as a formula prefix (= + - @ \t \r), prefix it
    // with a single quote so the spreadsheet renders it as text.
    const needsQuotePrefix = /^[=+\-@\t\r]/.test(s);
    const safe = needsQuotePrefix ? `'${s}` : s;
    // Always quote cells that contain commas, double quotes, or newlines
    // (RFC 4180). Also quote cells that got the formula-injection prefix
    // so spreadsheets don't strip the leading apostrophe.
    if (safe.includes(",") || safe.includes('"') || safe.includes("\n") || needsQuotePrefix) {
      return `"${safe.replace(/"/g, '""')}"`;
    }
    return safe;
  };
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => escape(row[h])).join(","));
  }
  return lines.join("\n");
}

export function csvResponse(filename: string, rows: Record<string, unknown>[]) {
  const csv = toCSV(rows);
  return new Response(`\uFEFF${csv}`, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
