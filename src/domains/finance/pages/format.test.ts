import { describe, expect, it } from "vitest";

import { formatMoneyScale } from "./format";

describe("formatMoneyScale", () => {
  it("formats a whole amount like any other money value", () => {
    expect(formatMoneyScale(12_000, "EUR")).toBe("120,00 €");
  });

  /*
   * Der Fall, der die Finanzseite in die Fehlergrenze gerissen hat: Die
   * Bibliothek beschriftet die Achse mit berechneten Teilstrichen, nicht mit
   * erfassten Beträgen.
   */
  it("survives a computed tick between two cents", () => {
    expect(formatMoneyScale(2400.5, "EUR")).toBe("24,01 €");
    expect(() => formatMoneyScale(9999.999, "EUR")).not.toThrow();
  });

  it("keeps a tick below zero readable instead of refusing it", () => {
    expect(formatMoneyScale(-2500, "EUR")).toBe("−25,00 €");
  });
});
