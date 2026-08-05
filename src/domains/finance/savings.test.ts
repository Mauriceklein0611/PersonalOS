import { describe, expect, it } from "vitest";

import { MixedCurrencyError } from "./mixed-currency";
import type { SavingsContribution, SavingsGoal } from "./model";
import {
  calculateSavingsProgress,
  describeSavingsDeadline,
  sortContributions,
} from "./savings";

const goalId = "00000000-0000-4000-8000-000000006101";
const otherGoalId = "00000000-0000-4000-8000-000000006102";

function buildGoal(overrides: Partial<SavingsGoal> = {}): SavingsGoal {
  return {
    createdAt: "2026-01-01T08:00:00.000Z",
    id: goalId,
    name: "Synthetisches Sparziel",
    status: "active",
    target: { amountMinor: 100_000, currency: "EUR" },
    updatedAt: "2026-01-01T08:00:00.000Z",
    ...overrides,
  } as SavingsGoal;
}

function buildContribution(
  overrides: Partial<SavingsContribution> = {},
): SavingsContribution {
  return {
    bookedOn: "2026-01-15",
    createdAt: "2026-01-15T08:00:00.000Z",
    id: "00000000-0000-4000-8000-000000006201",
    money: { amountMinor: 25_000, currency: "EUR" },
    savingsGoalId: goalId,
    updatedAt: "2026-01-15T08:00:00.000Z",
    ...overrides,
  } as SavingsContribution;
}

describe("calculateSavingsProgress", () => {
  it("derives the current amount only from contributions of the same goal", () => {
    const progress = calculateSavingsProgress(buildGoal(), [
      buildContribution({ money: { amountMinor: 25_000, currency: "EUR" } }),
      buildContribution({
        id: "00000000-0000-4000-8000-000000006202",
        money: { amountMinor: 10_050, currency: "EUR" },
      }),
      buildContribution({
        id: "00000000-0000-4000-8000-000000006203",
        money: { amountMinor: 99_999, currency: "EUR" },
        savingsGoalId: otherGoalId,
      }),
    ]);

    expect(progress.savedMinor).toBe(35_050);
    expect(progress.openMinor).toBe(64_950);
    expect(progress.contributionCount).toBe(2);
    expect(progress.state).toBe("open");
    expect(progress.summary).toBe("Ein Teil des Zielbetrags ist noch offen.");
  });

  it("stays neutral and empty without any contribution", () => {
    const progress = calculateSavingsProgress(buildGoal(), []);

    expect(progress.savedMinor).toBe(0);
    expect(progress.ratio).toBe(0);
    expect(progress.contributionCount).toBe(0);
  });

  it("ignores a withdrawn contribution", () => {
    const progress = calculateSavingsProgress(buildGoal(), [
      buildContribution(),
      buildContribution({
        archivedAt: "2026-01-16T08:00:00.000Z",
        id: "00000000-0000-4000-8000-000000006204",
      }),
    ]);

    expect(progress.savedMinor).toBe(25_000);
    expect(progress.contributionCount).toBe(1);
  });

  it("names an exactly reached target", () => {
    const progress = calculateSavingsProgress(buildGoal(), [
      buildContribution({ money: { amountMinor: 100_000, currency: "EUR" } }),
    ]);

    expect(progress.openMinor).toBe(0);
    expect(progress.ratio).toBe(1);
    expect(progress.state).toBe("reached");
    expect(progress.summary).toBe("Der Zielbetrag ist genau erreicht.");
  });

  // Über 100 Prozent bleibt eine Zahl, keine Ausnahme und keine Kappung.
  it("keeps an exceeded target mathematically correct", () => {
    const progress = calculateSavingsProgress(buildGoal(), [
      buildContribution({ money: { amountMinor: 150_000, currency: "EUR" } }),
    ]);

    expect(progress.savedMinor).toBe(150_000);
    expect(progress.openMinor).toBe(-50_000);
    expect(progress.ratio).toBe(1.5);
    expect(progress.state).toBe("exceeded");
    expect(progress.summary).toBe(
      "Der Zielbetrag ist erreicht; darüber hinaus sind weitere Beiträge erfasst.",
    );
  });

  it("reports no ratio instead of dividing by a target of zero", () => {
    const goal = buildGoal({ target: { amountMinor: 0, currency: "EUR" } });

    expect(calculateSavingsProgress(goal, []).ratio).toBeNull();
    expect(calculateSavingsProgress(goal, []).state).toBe("reached");
    expect(calculateSavingsProgress(goal, [buildContribution()]).state).toBe(
      "exceeded",
    );
  });

  it("refuses to add contributions in a foreign currency", () => {
    expect(() =>
      calculateSavingsProgress(buildGoal(), [
        buildContribution({ money: { amountMinor: 5_000, currency: "CHF" } }),
      ]),
    ).toThrow(MixedCurrencyError);
  });
});

describe("describeSavingsDeadline", () => {
  it("treats a missing deadline as a valid state", () => {
    expect(describeSavingsDeadline(buildGoal(), "2026-01-15")).toEqual({
      state: "none",
      text: "Ohne Frist",
    });
  });

  it("names today, the future and a passed deadline without urgency", () => {
    const goal = buildGoal({ targetDate: "2026-01-15" });

    expect(describeSavingsDeadline(goal, "2026-01-15").state).toBe("today");
    expect(describeSavingsDeadline(goal, "2026-01-14").state).toBe("upcoming");
    expect(describeSavingsDeadline(goal, "2026-01-16")).toEqual({
      state: "passed",
      text: "Frist liegt zurück",
    });
  });

  it("stops counting the deadline once the goal is closed", () => {
    const goal = buildGoal({ status: "completed", targetDate: "2026-01-15" });

    expect(describeSavingsDeadline(goal, "2026-02-01")).toEqual({
      state: "none",
      text: "Frist war 2026-01-15",
    });
  });
});

describe("sortContributions", () => {
  it("shows the most recent booking first", () => {
    const sorted = sortContributions([
      buildContribution({ bookedOn: "2026-01-10", id: "a" }),
      buildContribution({ bookedOn: "2026-02-01", id: "b" }),
      buildContribution({ bookedOn: "2026-01-20", id: "c" }),
    ]);

    expect(sorted.map((entry) => entry.id)).toEqual(["b", "c", "a"]);
  });
});
