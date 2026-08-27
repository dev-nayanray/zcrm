// Phone normalization for cross-channel customer matching.
//
// Phone numbers arrive in many formats:
//   - Meta lead: +8801712345678 (E.164)
//   - WhatsApp:  8801712345678 (no plus)
//   - Manual:    01712345678 (local)
//   - WooCommerce: 017-1234-5678 (with dashes)
//
// Without normalization, the same customer is duplicated across channels
// because lookup-by-phone fails. We normalize to a canonical form: digits
// only, with the leading country code (880 for Bangladesh) preserved.
//
//   01712345678   → 8801712345678
//   +8801712345678 → 8801712345678
//   8801712345678  → 8801712345678
//   017-1234-5678  → 8801712345678

const BD_COUNTRY_CODE = "880";

export function normalizePhone(input: string | null | undefined): string | null {
  if (!input) return null;
  // Strip everything that isn't a digit (dashes, spaces, parens, plus).
  let digits = input.replace(/[^\d]/g, "");
  if (!digits) return null;
  // Bangladesh normalization:
  //   01XXXXXXXXX (11 digits, starts with 0) → 8801XXXXXXXXX
  //   1XXXXXXXXX (10 digits, starts with 1) → 8801XXXXXXXXX
  //   8801XXXXXXXXX (already canonical) → unchanged
  if (digits.startsWith(BD_COUNTRY_CODE)) {
    return digits;
  }
  if (digits.startsWith("0")) {
    return BD_COUNTRY_CODE + digits.slice(1);
  }
  if (digits.startsWith("1") && digits.length === 10) {
    return BD_COUNTRY_CODE + digits;
  }
  // Fallback: return digits as-is (caller may pass international numbers
  // from other countries — we keep them intact so they at least match
  // themselves).
  return digits;
}

// Returns true if two raw phone strings normalize to the same canonical
// form. Useful for "is this the same customer?" checks.
export function phonesMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  const na = normalizePhone(a);
  const nb = normalizePhone(b);
  if (!na || !nb) return false;
  return na === nb;
}
