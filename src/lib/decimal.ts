// Decimal / money helpers. We use Prisma's Decimal to avoid floating-point money bugs.

import { Prisma } from "@prisma/client";

export type Money = Prisma.Decimal;

export function toDecimal(value: Prisma.Decimal | number | string | null | undefined): Prisma.Decimal {
  if (value === null || value === undefined || value === "") return new Prisma.Decimal(0);
  if (value instanceof Prisma.Decimal) return value;
  try {
    return new Prisma.Decimal(value);
  } catch {
    return new Prisma.Decimal(0);
  }
}

export function addMoney(...vals: (Prisma.Decimal | number | string | null | undefined)[]): Prisma.Decimal {
  return vals.reduce<Prisma.Decimal>((acc, v) => acc.plus(toDecimal(v)), new Prisma.Decimal(0));
}

export function subMoney(a: Prisma.Decimal | number | string, b: Prisma.Decimal | number | string): Prisma.Decimal {
  return toDecimal(a).minus(toDecimal(b));
}

export function mulMoney(a: Prisma.Decimal | number | string, b: Prisma.Decimal | number | string): Prisma.Decimal {
  return toDecimal(a).times(toDecimal(b));
}

export function divMoney(a: Prisma.Decimal | number | string, b: Prisma.Decimal | number | string): Prisma.Decimal {
  const d = toDecimal(b);
  if (d.isZero()) return new Prisma.Decimal(0);
  return toDecimal(a).div(d);
}

export function cmpMoney(a: Prisma.Decimal | number | string, b: Prisma.Decimal | number | string): number {
  return toDecimal(a).cmp(toDecimal(b));
}

export function isPositive(v: Prisma.Decimal | number | string | null | undefined): boolean {
  return toDecimal(v).gt(0);
}

export function isNegative(v: Prisma.Decimal | number | string | null | undefined): boolean {
  return toDecimal(v).lt(0);
}

export function isZero(v: Prisma.Decimal | number | string | null | undefined): boolean {
  return toDecimal(v).isZero();
}

// Format a Decimal as a BDT currency string for display.
export function formatCurrency(value: Prisma.Decimal | number | string | null | undefined): string {
  const d = toDecimal(value);
  const num = Number(d.toFixed(2));
  return new Intl.NumberFormat("en-US", {
    style: "decimal",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

// Convert any value to a plain number (for charts / serialization). Use carefully.
export function toNumber(value: Prisma.Decimal | number | string | null | undefined): number {
  return Number(toDecimal(value).toFixed(2));
}

// Serialize a Decimal safely to string for JSON responses.
export function decimalToString(value: Prisma.Decimal | number | string | null | undefined): string {
  return toDecimal(value).toFixed(2);
}
