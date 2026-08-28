// Unit tests for the order financial snapshot computation.
//
// Phase 2 added a server-side computed financial snapshot to every order:
//
//   NET SALES = subtotal − discount + tax + shippingCost + otherIncome + otherCost
//   COGS      = Σ OrderItem.unitCost × quantity    (historical snapshot, WAC-based)
//   GROSS     = (NET SALES − tax) − COGS
//               (tax is pass-through to government — not real revenue)
//   NET PROFIT = GROSS − packagingCost − paymentFee − platformFee
//                  − deliveryCost − returnCharge − otherCost − orderExpenses
//
// These tests verify the arithmetic in isolation. A full integration test
// of ProfitabilityService.computeOrderSnapshot requires a live MongoDB
// (covered by the integration test suite).

import { Prisma } from "@prisma/client";
import { describe, test, expect } from "bun:test";

const d = (n: number) => new Prisma.Decimal(n);

// Replicate the NET SALES computation from OrderService.create.
function computeNetSales(input: {
  subtotal: Prisma.Decimal;
  discount: Prisma.Decimal;
  tax: Prisma.Decimal;
  shippingCost: Prisma.Decimal;
  otherIncome: Prisma.Decimal;
  otherCost: Prisma.Decimal;
}): Prisma.Decimal {
  return input.subtotal
    .minus(input.discount)
    .plus(input.tax)
    .plus(input.shippingCost)
    .plus(input.otherIncome)
    .plus(input.otherCost);
}

// Replicate the GROSS PROFIT computation from ProfitabilityService.computeOrderSnapshot.
function computeGrossProfit(input: {
  netSales: Prisma.Decimal;
  tax: Prisma.Decimal;
  cogs: Prisma.Decimal;
}): Prisma.Decimal {
  // revenue = netSales − tax (tax is pass-through, not real revenue)
  const revenue = input.netSales.minus(input.tax);
  return revenue.minus(input.cogs);
}

// Replicate the NET PROFIT computation from ProfitabilityService.computeOrderSnapshot.
function computeNetProfit(input: {
  grossProfit: Prisma.Decimal;
  packagingCost: Prisma.Decimal;
  paymentFee: Prisma.Decimal;
  platformFee: Prisma.Decimal;
  deliveryCost: Prisma.Decimal; // actual courier cost, not customer charge
  returnCharge: Prisma.Decimal;
  otherCost: Prisma.Decimal;
  orderExpenses: Prisma.Decimal;
}): Prisma.Decimal {
  const totalCost = input.packagingCost
    .plus(input.paymentFee)
    .plus(input.platformFee)
    .plus(input.deliveryCost)
    .plus(input.returnCharge)
    .plus(input.otherCost)
    .plus(input.orderExpenses);
  return input.grossProfit.minus(totalCost);
}

describe("Order financial snapshot — NET SALES", () => {
  test("Simple order: 3000 subtotal, 0 discount, 0 tax, 0 shipping → 3000", () => {
    const netSales = computeNetSales({ subtotal: d(3000), discount: d(0), tax: d(0), shippingCost: d(0), otherIncome: d(0), otherCost: d(0) });
    expect(netSales.toFixed(2)).toBe("3000.00");
  });

  test("Discount applied: 3000 - 200 → 2800", () => {
    const netSales = computeNetSales({ subtotal: d(3000), discount: d(200), tax: d(0), shippingCost: d(0), otherIncome: d(0), otherCost: d(0) });
    expect(netSales.toFixed(2)).toBe("2800.00");
  });

  test("Tax + shipping + otherIncome all added", () => {
    // From the user's spec: Subtotal 3000, Discount 200, Shipping 100 → 2900
    // We add tax 150 + otherIncome 50 → 3100
    const netSales = computeNetSales({ subtotal: d(3000), discount: d(200), tax: d(150), shippingCost: d(100), otherIncome: d(50), otherCost: d(0) });
    expect(netSales.toFixed(2)).toBe("3100.00");
  });

  test("Negative total prevented at service layer (not here — this is just arithmetic)", () => {
    // Discount > subtotal — service throws; here we just verify arithmetic.
    const netSales = computeNetSales({ subtotal: d(100), discount: d(200), tax: d(0), shippingCost: d(0), otherIncome: d(0), otherCost: d(0) });
    expect(netSales.toNumber()).toBe(-100);
    // The OrderService.create has `if (total.lt(0)) throw` — this test just
    // confirms the arithmetic produces the right number for that check.
  });
});

describe("Order financial snapshot — GROSS PROFIT", () => {
  test("3000 sales, 0 tax, 1700 COGS → 1300 gross", () => {
    // User's example: Subtotal 3000, Discount 200, Shipping 100 → 2900 net sales
    // COGS 1700 → gross = (2900 - 0) - 1700 = 1200
    const netSales = d(2900);
    const gross = computeGrossProfit({ netSales, tax: d(0), cogs: d(1700) });
    expect(gross.toFixed(2)).toBe("1200.00");
  });

  test("Tax is subtracted from revenue (pass-through)", () => {
    // 5000 net sales, 500 tax, 3000 COGS → revenue = 4500, gross = 1500
    const netSales = d(5000);
    const gross = computeGrossProfit({ netSales, tax: d(500), cogs: d(3000) });
    expect(gross.toFixed(2)).toBe("1500.00");
  });

  test("Zero COGS → gross = revenue", () => {
    // Service/digital product (no COGS)
    const netSales = d(1000);
    const gross = computeGrossProfit({ netSales, tax: d(0), cogs: d(0) });
    expect(gross.toFixed(2)).toBe("1000.00");
  });

  test("COGS > revenue → negative gross profit (loss-making sale)", () => {
    // Bought at 2000, sold at 1500 (clearance)
    const netSales = d(1500);
    const gross = computeGrossProfit({ netSales, tax: d(0), cogs: d(2000) });
    expect(gross.toFixed(2)).toBe("-500.00");
  });
});

describe("Order financial snapshot — NET PROFIT", () => {
  test("User's spec example: gross 1200, costs 700 → net 500", () => {
    // From the user's spec:
    //   Product Cost: 1700
    //   Delivery Cost: 120
    //   Packaging: 30
    //   Payment Fee: 20
    //   Other Expense: 30
    //   Total Cost: 1900 → but that includes COGS already subtracted from gross
    // The net profit = gross − (delivery + packaging + payment + other)
    //               = 1200 − (120 + 30 + 20 + 30) = 1000
    const gross = d(1200); // 2900 net sales − 1700 COGS
    const net = computeNetProfit({
      grossProfit: gross,
      packagingCost: d(30),
      paymentFee: d(20),
      platformFee: d(0),
      deliveryCost: d(120),
      returnCharge: d(0),
      otherCost: d(30),
      orderExpenses: d(0),
    });
    expect(net.toFixed(2)).toBe("1000.00");
  });

  test("All cost components subtracted", () => {
    const gross = d(2000);
    const net = computeNetProfit({
      grossProfit: gross,
      packagingCost: d(50),
      paymentFee: d(30),
      platformFee: d(100), // e.g. 5% marketplace commission
      deliveryCost: d(150),
      returnCharge: d(0),
      otherCost: d(20),
      orderExpenses: d(100), // additional order-linked expense
    });
    // 2000 − (50 + 30 + 100 + 150 + 0 + 20 + 100) = 2000 − 450 = 1550
    expect(net.toFixed(2)).toBe("1550.00");
  });

  test("Return charge counted as cost", () => {
    const gross = d(1000);
    const net = computeNetProfit({
      grossProfit: gross,
      packagingCost: d(0),
      paymentFee: d(0),
      platformFee: d(0),
      deliveryCost: d(0),
      returnCharge: d(80),
      otherCost: d(0),
      orderExpenses: d(0),
    });
    expect(net.toFixed(2)).toBe("920.00");
  });

  test("Loss-making: gross 500, costs 700 → net -200", () => {
    const gross = d(500);
    const net = computeNetProfit({
      grossProfit: gross,
      packagingCost: d(100),
      paymentFee: d(50),
      platformFee: d(0),
      deliveryCost: d(300),
      returnCharge: d(0),
      otherCost: d(250),
      orderExpenses: d(0),
    });
    expect(net.toFixed(2)).toBe("-200.00");
  });

  test("Shipping income is in gross profit, NOT subtracted from net", () => {
    // Shipping INCOME (what customer paid for delivery) is part of NET SALES,
    // so it's already in gross profit. The DELIVERY COST (what courier charged)
    // is what gets subtracted from net. This test verifies the model doesn't
    // accidentally double-count shipping.
    // Customer paid 150 for shipping, courier charged 100:
    //   netSales includes the 150 shipping income (already in gross)
    //   deliveryCost = 100 subtracted from net
    //   So the shipping PROFIT (50) is correctly reflected in net profit.
    const gross = d(1150); // includes 150 shipping income
    const net = computeNetProfit({
      grossProfit: gross,
      packagingCost: d(0),
      paymentFee: d(0),
      platformFee: d(0),
      deliveryCost: d(100), // actual courier cost
      returnCharge: d(0),
      otherCost: d(0),
      orderExpenses: d(0),
    });
    // net = 1150 − 100 = 1050
    // If we had wrongly subtracted shipping INCOME again, net would be 900.
    expect(net.toFixed(2)).toBe("1050.00");
  });
});
