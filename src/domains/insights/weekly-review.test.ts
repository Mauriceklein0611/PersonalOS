import { describe, expect, it } from "vitest";

import {
  lifeScoreGoals,
  lifeScoreHabitEntries,
  lifeScoreHabits,
  lifeScoreJournalEntries,
  lifeScoreMilestones,
  lifeScoreTasks,
  lifeScoreTransactions,
} from "../../test/fixtures/life-score";
import {
  buildWeeklyReview,
  getReviewAnchorDay,
  getWeekPeriod,
  shiftWeek,
  type WeeklyReviewInput,
} from "./weekly-review";

const input: WeeklyReviewInput = {
  goals: lifeScoreGoals,
  habitEntries: lifeScoreHabitEntries,
  habits: lifeScoreHabits,
  journalEntries: lifeScoreJournalEntries,
  milestones: lifeScoreMilestones,
  tasks: lifeScoreTasks,
  transactions: lifeScoreTransactions,
};

const emptyInput: WeeklyReviewInput = {
  goals: [],
  habitEntries: [],
  habits: [],
  journalEntries: [],
  milestones: [],
  tasks: [],
  transactions: [],
};

// 2026-08-06 ist ein Donnerstag; die ISO-Woche läuft vom 3. bis 9. August.
const week = getWeekPeriod("2026-08-06");

describe("getWeekPeriod", () => {
  it("spans Monday to Sunday", () => {
    expect(week).toEqual({ from: "2026-08-03", to: "2026-08-09" });
  });

  it("steps a whole week in both directions", () => {
    expect(shiftWeek(week, -1)).toEqual({
      from: "2026-07-27",
      to: "2026-08-02",
    });
    expect(shiftWeek(week, 1)).toEqual({
      from: "2026-08-10",
      to: "2026-08-16",
    });
  });
});

describe("getReviewAnchorDay", () => {
  it("evaluates a finished week up to its Sunday", () => {
    expect(getReviewAnchorDay(week, "2026-09-01")).toBe("2026-08-09");
  });

  // Eine laufende Woche wird bis heute ausgewertet, nicht bis in die Zukunft.
  it("evaluates the current week only up to today", () => {
    expect(getReviewAnchorDay(week, "2026-08-06")).toBe("2026-08-06");
  });
});

describe("buildWeeklyReview", () => {
  it("names basis and period for every figure", () => {
    const review = buildWeeklyReview(input, week);

    expect(review.period).toEqual(week);
    for (const figure of [
      review.tasks,
      review.habits,
      review.journal,
      review.goals,
      review.finance,
    ]) {
      expect(figure.basis.length).toBeGreaterThan(0);
    }
  });

  it("counts planned against completed tasks of the week", () => {
    const review = buildWeeklyReview(input, week);

    // Vom 3. bis 9. August liegen 6 geplante Aufgaben; die abgebrochene und
    // die archivierte zählen nicht mit. Zwei davon sind erledigt.
    expect(review.tasks.valueText).toBe("2 von 6");
    expect(review.tasks.basis).toBe("Grundlage: 6 geplante Aufgaben.");
    expect(review.tasks.ratio).toBeCloseTo(2 / 6, 10);
  });

  it("reports habit units and names the skipped ones separately", () => {
    const review = buildWeeklyReview(input, week);

    // Zwei tägliche Gewohnheiten ergeben 14 Einheiten; 5 sind erledigt und
    // eine ist übersprungen — sie bleibt bewusst im Nenner.
    expect(review.habits.valueText).toBe("5 von 14");
    expect(review.habits.basis).toContain("1 übersprungen.");
  });

  it("shows only the number of journal days, never a text", () => {
    const review = buildWeeklyReview(input, week);

    expect(review.journal.valueText).toBe("4 von 7 Tagen");
    expect(JSON.stringify(review)).not.toContain("Freitext");
  });

  it("sums the expenses of the week as money", () => {
    const review = buildWeeklyReview(input, week);

    // Nur die Buchung vom 3. August liegt in der Woche. Das Leerzeichen vor
    // dem Zeichen ist ein geschütztes (U+00A0), wie `Intl` es setzt.
    expect(review.finance.valueText).toBe("250,00 €");
    expect(review.finance.basis).toBe("Grundlage: 1 Ausgabe dieser Woche.");
  });

  it("refuses a mixed-currency sum instead of converting it", () => {
    const review = buildWeeklyReview(
      {
        ...emptyInput,
        transactions: [
          lifeScoreTransactions[1],
          {
            ...lifeScoreTransactions[2],
            bookedOn: "2026-08-05",
            money: { amountMinor: 1_000, currency: "CHF" },
          },
        ],
      },
      week,
    );

    expect(review.finance.valueText).toBe("Keine Angabe");
    expect(review.finance.basis).toContain("Währungen");
  });

  it("describes an empty week as a helpful state, not as zero", () => {
    const review = buildWeeklyReview(emptyInput, week);

    expect(review.tasks.valueText).toBe("Keine Angabe");
    expect(review.tasks.basis).toBe(
      "Für diese Woche war keine Aufgabe geplant.",
    );
    expect(review.habits.basis).toBe(
      "In dieser Woche war keine Gewohnheit fällig.",
    );
    expect(review.goals.basis).toBe("Es ist kein Ziel aktiv.");
    expect(review.finance.basis).toBe(
      "In dieser Woche ist keine Ausgabe gebucht.",
    );
    expect(review.tasks.ratio).toBeNull();
  });

  it("works when a single domain has no records at all", () => {
    const review = buildWeeklyReview({ ...input, habits: [] }, week);

    expect(review.habits.valueText).toBe("Keine Angabe");
    expect(review.tasks.valueText).toBe("2 von 6");
  });
});
