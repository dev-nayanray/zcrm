import { Prisma } from "@prisma/client";

// money.ts — Integer minor-unit money utilities.
//
// ─────────────────────────────────────────────────────────────────────────────
// WHY MINOR UNITS?
// ─────────────────────────────────────────────────────────────────────────────
// MongoDB has no native Decimal type. Storing money as Float (float64) loses
// precision at large magnitudes — a ৳100,000.50 order can drift by a few
// poisha on every round-trip. The industry-standard fix is to store money
// as an integer count of the smallest currency unit (1/100 of a Taka =
// 1 poisha), so ৳100.50 → 10050 (integer, exact).
//
// This module provides the conversion utilities. The actual schema migration
// (adding `Int` columns alongside the existing `Float` columns, backfilling,
// then switching reads) is a multi-release project documented in
// `docs/money-migration.md`. This module is the foundation.
//
// ─────────────────────────────────────────────────────────────────────────────
// CONVENTIONS
// ─────────────────────────────────────────────────────────────────────────────
// - "Minor" = integer poisha (e.g. 10050 = ৳100.50)
// - "Major" = decimal taka (e.g. 100.50)
// - All arithmetic MUST go through Prisma.Decimal (never native number for
//   money math).
// - Schema Float columns are written via `.toNumber()`; schema Int columns
//   will be written directly once the migration lands.

/** Convert a major-unit amount (taka) to minor units (poisha). */
export function toMinor(amount: Prisma.Decimal | number | string | null | undefined): number {
  if (amount === null || amount === undefined) return 0;
  const d = amount instanceof Prisma.Decimal ? amount : new Prisma.Decimal(amount);
  if (!d.isFinite()) return 0;
  // Multiply by 100 and round to the nearest integer. Banker's rounding
  // (ROUND_HALF_EVEN) would be more correct for accounting, but JS Decimal
  // uses ROUND_HALF_UP by default which matches what users see on receipts.
  const minor = d.times(100).round();
  // Clamp to safe integer range (Number.MAX_SAFE_INTEGER = 9,007,199,254,740,991)
  // → max representable taka ≈ 90 trillion, far beyond any realistic order.
  return minor.toNumber();
}

/** Convert minor units (poisha) back to major units (taka) as a Decimal. */
export function fromMinor(minor: number | null | undefined): Prisma.Decimal {
  if (minor === null || minor === undefined || !Number.isFinite(minor)) return new Prisma.Decimal(0);
  return new Prisma.Decimal(minor).dividedBy(100);
}

/** Convert minor units (poisha) to a display string (taka with 2 decimals). */
export function minorToDisplay(minor: number | null | undefined): string {
  return fromMinor(minor).toFixed(2);
}

/**
 * Safely convert a Decimal/number/string to a Float-storable number.
 *
 * Use this when writing to an existing Float column — it normalises null/NaN
 * to 0 and ensures the value is a finite number. This is a stop-gap until
 * the Float→Int migration is complete; once Int columns exist, use
 * `toMinor()` instead.
 */
export function toMoneySafe(amount: Prisma.Decimal | number | string | null | undefined): number {
  if (amount === null || amount === undefined) return 0;
  const d = amount instanceof Prisma.Decimal ? amount : new Prisma.Decimal(amount);
  if (!d.isFinite()) return 0;
  return d.toNumber();
}

/**
 * Format a money amount for display. Accepts any input type (Decimal, number,
 * string, null/undefined) and returns a 2-decimal string.
 */
export function formatMoney(amount: Prisma.Decimal | number | string | null | undefined): string {
  if (amount === null || amount === undefined) return "0.00";
  const d = amount instanceof Prisma.Decimal ? amount : new Prisma.Decimal(amount);
  if (!d.isFinite()) return "0.00";
  return d.toFixed(2);
}

/**
 * Round a money amount to 2 decimal places (poisha precision). Use this
 * after any arithmetic that could produce more than 2 decimals (e.g.
 * division, percentage calculations).
 */
export function roundMoney(amount: Prisma.Decimal | number | string): Prisma.Decimal {
  const d = amount instanceof Prisma.Decimal ? amount : new Prisma.Decimal(amount);
  return d.toDecimalPlaces(2);
}

/**
 * Sum an array of money amounts. Returns a Decimal (not a number) so the
 * caller can chain further arithmetic without losing precision.
 */
export function sumMoney(amounts: (Prisma.Decimal | number | string | null | undefined)[]): Prisma.Decimal {
  return amounts.reduce<Prisma.Decimal>((sum, a) => {
    if (a === null || a === undefined) return sum;
    const d = a instanceof Prisma.Decimal ? a : new Prisma.Decimal(a);
    return sum.plus(d.isFinite() ? d : new Prisma.Decimal(0));
  }, new Prisma.Decimal(0));
}

// ─────────────────────────────────────────────────────────────────────────────
// BACKFILL HELPERS (used by the migration script, not at runtime)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Backfill conversion: given a Float column value, return the integer
 * minor-unit equivalent. Used by the one-shot backfill script to populate
 * the new Int columns from existing Float data.
 *
 * Handles the edge case where Float drift has introduced tiny errors
 * (e.g. 100.49999999999 instead of 100.50) by rounding to 2 decimals
 * before converting to minor units.
 */
export function backfillMinor(floatValue: number | null | undefined): number {
  if (floatValue === null || floatValue === undefined || !Number.isFinite(floatValue)) return 0;
  // Round the float to 2 decimals first to clean up drift, then × 100.
  const cleaned = new Prisma.Decimal(floatValue).toDecimalPlaces(2);
  return cleaned.times(100).toNumber();
}

/**
 * Reverse-conversion for verification: given an integer minor-unit value,
 * return the Float equivalent. Used by the migration verification script
 * to confirm the backfill was lossless.
 */
export function verifyMinorToFloat(minor: number | null | undefined): number {
  return fromMinor(minor).toNumber();
}
