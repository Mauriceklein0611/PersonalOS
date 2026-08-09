import { describe, expect, it } from "vitest";

import { buildEntityMeta } from "../../test/factories/entity";
import {
  lifeScoreGoals,
  lifeScoreHabitEntries,
  lifeScoreHabits,
  lifeScoreJournalEntries,
  lifeScoreMilestones,
  lifeScoreTasks,
  lifeScoreTransactions,
} from "../../test/fixtures/life-score";
import type { Habit, HabitEntry } from "../habits/model";
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

    // Zwei tägliche Gewohnheiten ergeben 14 geplante Einheiten; 5 sind
    // erledigt und eine ist übersprungen — sie fällt aus dem Nenner.
    expect(review.habits.valueText).toBe("5 von 13");
    expect(review.habits.basis).toContain("13 zählende Einheiten");
    expect(review.habits.basis).toContain(
      "1 von 14 geplanten Einheiten übersprungen",
    );
    expect(review.habits.ratio).toBeCloseTo(5 / 13, 10);
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

/**
 * `hasBasis` ist das strukturelle Signal, an dem jede Darstellung entscheidet
 * — nicht `ratio === null` (bei Finanzen und Zielen strukturell immer `null`)
 * und nicht `sourceCount === 0` (Journal hat mit null Einträgen trotzdem eine
 * Grundlage, übersprungene Gewohnheiten und Mehrwährungsbuchungen haben trotz
 * `sourceCount > 0` keine). Diese Tests decken genau die Fälle ab, in denen
 * `hasBasis` von beiden anderen Feldern abweicht.
 */
describe("WeeklyFigure.hasBasis", () => {
  it("is true for every figure when there is data to report", () => {
    const review = buildWeeklyReview(input, week);

    expect(review.tasks.hasBasis).toBe(true);
    expect(review.habits.hasBasis).toBe(true);
    expect(review.journal.hasBasis).toBe(true);
    expect(review.goals.hasBasis).toBe(true);
    expect(review.finance.hasBasis).toBe(true);
  });

  it("is false for tasks, habits, goals and finance without any record", () => {
    const review = buildWeeklyReview(emptyInput, week);

    expect(review.tasks.hasBasis).toBe(false);
    expect(review.habits.hasBasis).toBe(false);
    expect(review.goals.hasBasis).toBe(false);
    expect(review.finance.hasBasis).toBe(false);
  });

  it("stays true for the journal without a single entry — the week itself is the basis", () => {
    const review = buildWeeklyReview(emptyInput, week);

    expect(review.journal.sourceCount).toBe(0);
    expect(review.journal.hasBasis).toBe(true);
    expect(review.journal.valueText).toBe("0 von 7 Tagen");
  });

  it("is false for habits where every planned unit was skipped, even though habits existed", () => {
    const habit: Habit = {
      ...buildEntityMeta({ id: "00000000-0000-4000-8000-000000009001" }),
      name: "Testgewohnheit",
      schedule: { kind: "daily" },
      startDate: "2026-07-01",
    };
    const entries: HabitEntry[] = [
      "2026-08-03",
      "2026-08-04",
      "2026-08-05",
      "2026-08-06",
      "2026-08-07",
      "2026-08-08",
      "2026-08-09",
    ].map((localDate, index) => ({
      ...buildEntityMeta({
        id: `00000000-0000-4000-8000-00000000910${index}`,
      }),
      habitId: habit.id,
      localDate,
      status: "skipped" as const,
    }));

    const review = buildWeeklyReview(
      { ...emptyInput, habitEntries: entries, habits: [habit] },
      week,
    );

    // Die Gewohnheit war fällig — `sourceCount` zählt sie —, aber ohne eine
    // einzige zählende Einheit gibt es keine Quote.
    expect(review.habits.sourceCount).toBe(1);
    expect(review.habits.hasBasis).toBe(false);
    expect(review.habits.valueText).toBe("Keine Angabe");
  });

  it("is false for a mixed-currency booking even though bookings exist", () => {
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

    expect(review.finance.sourceCount).toBeGreaterThan(0);
    expect(review.finance.hasBasis).toBe(false);
  });

  it("stays true for goals with zero completed milestones in the week", () => {
    const review = buildWeeklyReview(input, week);

    // Vier aktive Ziele, aber kein Meilenstein abgeschlossen in dieser Woche:
    // ein gültiges Ergebnis, keine fehlende Grundlage.
    expect(review.goals.valueText).toBe("0 Meilensteine");
    expect(review.goals.hasBasis).toBe(true);
  });
});
