import { describe, expect, it } from "vitest";

import {
  createContributionFormValues,
  createSavingsGoalFormValues,
  toContributionDetails,
  toSavingsGoalDetails,
} from "./savings-form-values";

const goalId = "00000000-0000-4000-8000-000000007101";

describe("toSavingsGoalDetails", () => {
  it("reads a German amount exactly and keeps an empty deadline open", () => {
    const result = toSavingsGoalDetails(
      {
        name: "  Synthetisches Sparziel  ",
        target: "1.200,50",
        targetDate: "",
      },
      "EUR",
    );

    expect(result).toEqual({
      details: {
        name: "Synthetisches Sparziel",
        status: "active",
        target: { amountMinor: 120_050, currency: "EUR" },
      },
      ok: true,
    });
  });

  it("keeps a given deadline", () => {
    const result = toSavingsGoalDetails(
      { name: "Sparziel", target: "10,00", targetDate: "2026-12-31" },
      "EUR",
    );

    expect(result.ok && result.details.targetDate).toBe("2026-12-31");
  });

  it("reports every problem at once with a correction hint", () => {
    const result = toSavingsGoalDetails(
      { name: "   ", target: "-5", targetDate: "31.12.2026" },
      "EUR",
    );

    expect(result).toEqual({
      errors: {
        name: "Gib einen Namen mit mindestens einem Zeichen ein.",
        target: "Gib einen Betrag ohne Vorzeichen ein, zum Beispiel 250,00.",
        targetDate: "Wähle ein gültiges Datum oder lass die Frist leer.",
      },
      ok: false,
    });
  });

  it("starts empty", () => {
    expect(createSavingsGoalFormValues()).toEqual({
      name: "",
      target: "",
      targetDate: "",
    });
  });
});

describe("toContributionDetails", () => {
  it("binds the amount to its goal and drops an empty note", () => {
    const result = toContributionDetails(
      { amount: "50,00", bookedOn: "2026-01-15", note: "   " },
      goalId,
      "EUR",
    );

    expect(result).toEqual({
      details: {
        bookedOn: "2026-01-15",
        money: { amountMinor: 5_000, currency: "EUR" },
        savingsGoalId: goalId,
      },
      ok: true,
    });
  });

  it("rejects too many decimal places and an unreadable date", () => {
    const result = toContributionDetails(
      { amount: "5,005", bookedOn: "15.01.2026", note: "" },
      goalId,
      "EUR",
    );

    expect(result).toEqual({
      errors: {
        amount: "Gib höchstens zwei Nachkommastellen ein, zum Beispiel 250,00.",
        bookedOn: "Wähle ein gültiges Datum.",
      },
      ok: false,
    });
  });

  it("prefills the current day", () => {
    expect(createContributionFormValues("2026-08-04").bookedOn).toBe(
      "2026-08-04",
    );
  });
});
