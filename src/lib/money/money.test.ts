import { describe, expect, it } from "vitest";

import { buildMoney } from "../../test/factories/entity";
import { addMoney, createMoney, moneySchema } from "./money";

describe("money helpers", () => {
  it("stores non-negative safe integers in a supported ISO currency", () => {
    expect(createMoney(1_099, "EUR")).toEqual({
      amountMinor: 1_099,
      currency: "EUR",
    });
    expect(() => createMoney(10.99, "EUR")).toThrow();
    expect(() => createMoney(-1, "EUR")).toThrow();
    expect(() => createMoney(100, "eur")).toThrow();
    expect(() => createMoney(100, "AAA")).toThrow();
  });

  it("adds only matching currencies without floating point values", () => {
    expect(
      addMoney(
        buildMoney({ amountMinor: 1_250 }),
        buildMoney({ amountMinor: 75 }),
      ),
    ).toEqual({ amountMinor: 1_325, currency: "EUR" });
    expect(() =>
      addMoney(buildMoney(), buildMoney({ currency: "USD" })),
    ).toThrow(/Currencies must match/);
  });

  it("rejects unknown fields at the persistence boundary", () => {
    expect(
      moneySchema.safeParse({
        amountMinor: 100,
        currency: "EUR",
        amount: 1,
      }).success,
    ).toBe(false);
  });
});
