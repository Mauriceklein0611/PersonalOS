import { describe, expect, it } from "vitest";

import {
  countPropertyReads,
  createAccessCounter,
} from "../../test/access-counter";
import { addCalendarDays } from "../../lib/dates/calendar-days";
import type { CalendarDay } from "../../lib/dates/date-values";
import { buildHabitMonthView, type HabitMonthCellState } from "./month-view";
import type { Habit, HabitEntry } from "./model";
import { createHabit, createHabitEntry, habitId } from "./test-factories";

function buildView(
  habits: Habit[],
  entries: HabitEntry[],
  month: string,
  today: CalendarDay,
  weekStartsOn: 1 | 7 = 1,
) {
  return buildHabitMonthView({
    entriesByHabit: new Map(habits.map((habit) => [habit.id, entries])),
    habits,
    month,
    today,
    weekStartsOn,
  });
}

function stateOn(
  view: ReturnType<typeof buildView>,
  day: CalendarDay,
): HabitMonthCellState {
  const cell = view.rows[0].cells.find((candidate) => candidate.day === day);
  if (cell === undefined) throw new Error(`Kein Tag ${day} im Raster`);
  return cell.state;
}

describe("buildHabitMonthView", () => {
  it("builds months with 28, 29, 30 and 31 days", () => {
    const habit = createHabit({ startDate: "2026-01-01" });

    expect(buildView([habit], [], "2026-02", "2026-12-31").days).toHaveLength(
      28,
    );
    expect(buildView([habit], [], "2028-02", "2028-12-31").days).toHaveLength(
      29,
    );
    expect(buildView([habit], [], "2026-04", "2026-12-31").days).toHaveLength(
      30,
    );
    expect(buildView([habit], [], "2026-08", "2026-12-31").days).toHaveLength(
      31,
    );
  });

  it("keeps a month with a DST switch at its full length", () => {
    const view = buildView(
      [createHabit({ startDate: "2026-01-01" })],
      [],
      "2026-03",
      "2026-12-31",
    );

    expect(view.days).toHaveLength(31);
    expect(view.days.map((day) => day.day)).toContain("2026-03-29");
    expect(view.to).toBe("2026-03-31");
  });

  it("groups the columns into weeks by the configured week start", () => {
    const habit = createHabit({ startDate: "2026-01-01" });

    const monday = buildView([habit], [], "2026-08", "2026-08-31");
    expect(monday.weeks[0]).toEqual({
      days: ["2026-08-01", "2026-08-02"],
      start: "2026-07-27",
    });
    expect(monday.weeks[1].start).toBe("2026-08-03");
    expect(monday.days[2].isWeekStart).toBe(true);

    const sunday = buildView([habit], [], "2026-08", "2026-08-31", 7);
    expect(sunday.weeks[0]).toEqual({
      days: ["2026-08-01"],
      start: "2026-07-26",
    });
    expect(sunday.weeks[1].start).toBe("2026-08-02");
    expect(sunday.days[1].isWeekStart).toBe(true);
  });

  it("limits due cells to the active period of the routine", () => {
    const habit = createHabit({
      endDate: "2026-08-20",
      startDate: "2026-08-10",
    });
    const view = buildView([habit], [], "2026-08", "2026-08-31");

    expect(stateOn(view, "2026-08-09")).toBe("outside");
    expect(stateOn(view, "2026-08-10")).toBe("open");
    expect(stateOn(view, "2026-08-20")).toBe("open");
    expect(stateOn(view, "2026-08-21")).toBe("outside");
  });

  it("shows a check-in outside the active period instead of hiding it", () => {
    const habit = createHabit({ startDate: "2026-08-10" });
    const view = buildView(
      [habit],
      [createHabitEntry("2026-08-05")],
      "2026-08",
      "2026-08-31",
    );

    expect(stateOn(view, "2026-08-05")).toBe("done");
  });

  it("keeps weekday routines free on days without a plan", () => {
    const habit = createHabit({
      schedule: { days: [1, 3], kind: "weekdays" },
      startDate: "2026-08-01",
    });
    const view = buildView([habit], [], "2026-08", "2026-08-31");

    // 3. August 2026 ist ein Montag, der 4. ein Dienstag.
    expect(stateOn(view, "2026-08-03")).toBe("open");
    expect(stateOn(view, "2026-08-04")).toBe("not-due");
    expect(stateOn(view, "2026-08-05")).toBe("open");
  });

  it("stops a times-per-week routine once the week target is reached", () => {
    const habit = createHabit({
      schedule: { count: 2, kind: "timesPerWeek" },
      startDate: "2026-08-01",
    });
    const view = buildView(
      [habit],
      [createHabitEntry("2026-08-03"), createHabitEntry("2026-08-04")],
      "2026-08",
      "2026-08-31",
    );

    expect(stateOn(view, "2026-08-03")).toBe("done");
    expect(stateOn(view, "2026-08-04")).toBe("done");
    // Das Wochenziel ist erfüllt; der Rest der Woche ist keine Lücke.
    expect(stateOn(view, "2026-08-05")).toBe("not-due");
    // Die neue Woche beginnt am Montag wieder offen.
    expect(stateOn(view, "2026-08-10")).toBe("open");
    // Sechs angeschnittene Wochen: 2 + 2 + 2 + 2 + 2 + 1 geplante Einheiten.
    expect(view.rows[0].fulfillment).toMatchObject({ counted: 11, done: 2 });
  });

  it("counts a skip out of the denominator and reports it separately", () => {
    const habit = createHabit({ startDate: "2026-08-01" });
    const view = buildView(
      [habit],
      [
        createHabitEntry("2026-08-01"),
        createHabitEntry("2026-08-02", "skipped"),
      ],
      "2026-08",
      "2026-08-03",
    );

    expect(stateOn(view, "2026-08-02")).toBe("skipped");
    expect(view.days[1]).toMatchObject({ counted: 0, done: 0, skipped: 1 });
    expect(view.days[1].rate).toBeNull();
    expect(view.summary).toMatchObject({ counted: 2, done: 1, skipped: 1 });
    expect(view.rows[0].fulfillment).toMatchObject({
      counted: 2,
      done: 1,
      skipped: 1,
    });
  });

  it("never counts a future or not-due day as a failure", () => {
    const habit = createHabit({ startDate: "2026-08-01" });
    const view = buildView([habit], [], "2026-08", "2026-08-03");

    expect(stateOn(view, "2026-08-03")).toBe("open");
    expect(stateOn(view, "2026-08-04")).toBe("future");
    expect(view.days[3]).toMatchObject({
      counted: 0,
      due: 0,
      isFuture: true,
      rate: null,
    });
    expect(view.countedTo).toBe("2026-08-03");
    // Nur die drei vergangenen Tage bilden den Nenner, nicht der ganze Monat.
    expect(view.rows[0].fulfillment).toMatchObject({ counted: 3, done: 0 });
  });

  it("leaves a month in the future without a rate instead of showing zero", () => {
    const habit = createHabit({ startDate: "2026-08-01" });
    const view = buildView([habit], [], "2026-09", "2026-08-03");

    expect(view.countedTo).toBeUndefined();
    expect(view.rows[0].fulfillment).toBeUndefined();
    expect(view.summary.rate).toBeNull();
    expect(view.days.every((day) => day.counted === 0)).toBe(true);
  });

  it("marks today and derives the daily rate from the counted units", () => {
    const habits = [
      createHabit({ startDate: "2026-08-01" }),
      createHabit({
        id: "00000000-0000-4000-8000-000000001002",
        name: "Zweite synthetische Routine",
        startDate: "2026-08-01",
      }),
    ];
    const view = buildHabitMonthView({
      entriesByHabit: new Map([[habitId, [createHabitEntry("2026-08-03")]]]),
      habits,
      month: "2026-08",
      today: "2026-08-03",
    });

    const third = view.days[2];
    expect(third.isToday).toBe(true);
    expect(third).toMatchObject({ counted: 2, done: 1, due: 2 });
    expect(third.rate).toBe(0.5);
  });

  it("only lists routines that were active in the month", () => {
    const view = buildView(
      [
        createHabit({ startDate: "2026-09-01" }),
        createHabit({
          archivedAt: "2026-08-05T08:00:00.000Z",
          id: "00000000-0000-4000-8000-000000001003",
          startDate: "2026-08-01",
        }),
        createHabit({
          endDate: "2026-07-31",
          id: "00000000-0000-4000-8000-000000001004",
          startDate: "2026-07-01",
        }),
      ],
      [],
      "2026-08",
      "2026-08-31",
    );

    expect(view.rows).toHaveLength(0);
  });

  it("allows a check-in only where the week view allows one", () => {
    const habit = createHabit({
      schedule: { days: [1], kind: "weekdays" },
      startDate: "2026-08-01",
    });
    const view = buildView([habit], [], "2026-08", "2026-08-10");

    const interactive = view.rows[0].cells
      .filter((cell) => cell.interactive)
      .map((cell) => cell.day);
    // Nur vergangene Montage: der 3. und der 10. August 2026.
    expect(interactive).toEqual(["2026-08-03", "2026-08-10"]);
  });
});

/*
 * Arbeitsbudget, Issue #124. Das Monatsraster ist die dichteste Ansicht der
 * Routinen: 31 Spalten je aktiver Routine. Gemessen wird die Zahl der
 * Feldzugriffe auf die Check-ins, nicht die Wanduhrzeit.
 */
describe("buildHabitMonthView – Arbeitsbudget", () => {
  function measure(habitCount: number, historyDays: number): number {
    const counter = createAccessCounter();
    const habits = Array.from({ length: habitCount }, (_, index) =>
      createHabit({
        id: `00000000-0000-4000-8000-00000000${String(2000 + index).padStart(4, "0")}`,
        startDate: "2020-01-01",
      }),
    );
    const entriesByHabit = new Map(
      habits.map((habit) => [
        habit.id,
        countPropertyReads(
          Array.from({ length: historyDays }, (_, day) =>
            createHabitEntry(addCalendarDays("2026-08-31", -day), "done", {
              habitId: habit.id,
            }),
          ),
          counter,
        ),
      ]),
    );

    buildHabitMonthView({
      entriesByHabit,
      habits,
      month: "2026-08",
      today: "2026-08-31",
    });
    return counter.reads;
  }

  it("touches the history once, not once per column", () => {
    const short = measure(1, 400);
    const long = measure(1, 1_200);

    /*
     * Der Ausschnitt auf den Monat läuft einmal über die Historie; alles
     * danach arbeitet auf dem Ausschnitt. Wenige Zugriffe je zusätzlichem
     * Eintrag sind dieser eine Lauf. Ohne den Ausschnitt wüchse die Differenz
     * um den Faktor der 31 Spalten.
     */
    // Gemessen: zwei Zugriffe je zusätzlichem Eintrag.
    expect(long - short).toBeLessThanOrEqual(800 * 3);
  });

  it("stays inside the documented budget for a dense month", () => {
    // 30 Routinen mit je zwei Jahren täglicher Check-ins: gemessen 82.530
    // Zugriffe, dokumentiert in `docs/KNOWN_LIMITATIONS.md`.
    expect(measure(30, 730)).toBeLessThan(120_000);
  });
});
