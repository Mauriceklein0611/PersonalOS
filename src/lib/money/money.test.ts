import { describe, expect, it } from "vitest";

import { buildMoney } from "../../test/factories/entity";
import {
  addMoney,
  createMoney,
  formatMoney,
  formatSignedMinorUnits,
  getCurrencyExponent,
  moneySchema,
  parseMoneyInput,
  subtractMoney,
  sumMoney,
} from "./money";

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

  it("sums a list and reports the difference as integer minor units", () => {
    expect(
      sumMoney(
        [
          buildMoney({ amountMinor: 10 }),
          buildMoney({ amountMinor: 20 }),
          buildMoney({ amountMinor: 3 }),
        ],
        "EUR",
      ),
    ).toEqual({ amountMinor: 33, currency: "EUR" });
    expect(sumMoney([], "EUR")).toEqual({ amountMinor: 0, currency: "EUR" });
    expect(
      subtractMoney(
        buildMoney({ amountMinor: 500 }),
        buildMoney({ amountMinor: 1_250 }),
      ),
    ).toBe(-750);
  });

  it("derives the minor unit exponent from the currency", () => {
    expect(getCurrencyExponent("EUR")).toBe(2);
    expect(getCurrencyExponent("JPY")).toBe(0);
  });
});

describe("parseMoneyInput", () => {
  it("reads German amounts without floating point rounding", () => {
    expect(parseMoneyInput("12,50", "EUR")).toEqual({
      money: { amountMinor: 1_250, currency: "EUR" },
      ok: true,
    });
    expect(parseMoneyInput("0,10", "EUR")).toEqual({
      money: { amountMinor: 10, currency: "EUR" },
      ok: true,
    });
    expect(parseMoneyInput("1.234,56", "EUR")).toEqual({
      money: { amountMinor: 123_456, currency: "EUR" },
      ok: true,
    });
    expect(parseMoneyInput("7", "EUR")).toEqual({
      money: { amountMinor: 700, currency: "EUR" },
      ok: true,
    });
    expect(parseMoneyInput("3,5", "EUR")).toEqual({
      money: { amountMinor: 350, currency: "EUR" },
      ok: true,
    });
  });

  it("keeps 0,1 plus 0,2 exact", () => {
    const first = parseMoneyInput("0,1", "EUR");
    const second = parseMoneyInput("0,2", "EUR");
    if (!first.ok || !second.ok) throw new Error("expected valid amounts");

    expect(addMoney(first.money, second.money).amountMinor).toBe(30);
  });

  it("names why an input was rejected", () => {
    expect(parseMoneyInput("   ", "EUR")).toEqual({
      ok: false,
      reason: "empty",
    });
    expect(parseMoneyInput("-5", "EUR")).toEqual({
      ok: false,
      reason: "format",
    });
    expect(parseMoneyInput("abc", "EUR")).toEqual({
      ok: false,
      reason: "format",
    });
    expect(parseMoneyInput("1,234", "EUR")).toEqual({
      ok: false,
      reason: "precision",
    });
  });
});

describe("money formatting", () => {
  it("formats an amount with its currency", () => {
    expect(formatMoney(buildMoney({ amountMinor: 1_250 }))).toMatch(/12,50/);
    expect(formatMoney(buildMoney({ amountMinor: 0 }))).toMatch(/0,00/);
  });

  it("marks a signed balance without implying a judgement", () => {
    expect(formatSignedMinorUnits(1_250, "EUR")).toMatch(/^\+/);
    expect(formatSignedMinorUnits(-1_250, "EUR")).toMatch(/^−/);
    expect(formatSignedMinorUnits(0, "EUR")).toMatch(/^0,00/);
  });
});
