import { describe, expect, it } from "vitest";

import { addCalendarDays } from "../../lib/dates/calendar-days";
import {
  countPropertyReads,
  createAccessCounter,
} from "../../test/access-counter";
import type { Task } from "./model";
import { buildTaskWeekPlan } from "./week-plan";

// Der 30. März 2026 ist ein Montag; die Woche endet am Sonntag, dem 5. April.
const monday = "2026-03-30";

describe("buildTaskWeekPlan", () => {
  it("derives the week from the week start and ignores neighbouring days", () => {
    const before = createTask("01", { plannedDate: "2026-03-29" });
    const first = createTask("02", { plannedDate: monday });
    const last = createTask("03", { plannedDate: "2026-04-05" });
    const after = createTask("04", { plannedDate: "2026-04-06" });

    const plan = buildTaskWeekPlan({
      tasks: [before, first, last, after],
      today: "2026-04-01",
    });

    expect([plan.from, plan.to]).toEqual([monday, "2026-04-05"]);
    expect(plan.days).toHaveLength(7);
    expect(plan.planned).toBe(2);
    expect(plan.days[0].tasks).toEqual([first]);
    expect(plan.days[6].tasks).toEqual([last]);
  });

  it("follows a Sunday week start across the DST switch", () => {
    const plan = buildTaskWeekPlan({
      tasks: [],
      today: "2026-04-01",
      weekStartsOn: 7,
    });

    // Der 29. März 2026 ist der Umstellungstag auf die Sommerzeit. Ein
    // Kalendertag bleibt ein Kalendertag: Die Woche hat trotzdem sieben.
    expect([plan.from, plan.to]).toEqual(["2026-03-29", "2026-04-04"]);
    expect(plan.days).toHaveLength(7);
    expect(plan.days[0].day).toBe("2026-03-29");
  });

  it("keeps the week stable across a month and a year boundary", () => {
    const overMonth = buildTaskWeekPlan({ tasks: [], today: "2026-04-01" });
    expect(overMonth.days.map((day) => day.day)).toEqual([
      "2026-03-30",
      "2026-03-31",
      "2026-04-01",
      "2026-04-02",
      "2026-04-03",
      "2026-04-04",
      "2026-04-05",
    ]);

    const overYear = buildTaskWeekPlan({ tasks: [], today: "2026-01-01" });
    expect([overYear.from, overYear.to]).toEqual(["2025-12-29", "2026-01-04"]);
  });

  it("keeps the same denominator when a task is completed", () => {
    const open = createTask("05", { plannedDate: monday });
    const before = buildTaskWeekPlan({ tasks: [open], today: monday });
    const after = buildTaskWeekPlan({
      tasks: [
        {
          ...open,
          completedAt: "2026-03-30T10:00:00.000Z",
          status: "completed",
        },
      ],
      today: monday,
    });

    expect(before.days[0]).toMatchObject({ completed: 0, planned: 1, rate: 0 });
    expect(after.days[0]).toMatchObject({ completed: 1, planned: 1, rate: 1 });
    expect(after.planned).toBe(before.planned);
  });

  it("leaves an empty day without a made-up zero", () => {
    const plan = buildTaskWeekPlan({
      tasks: [createTask("06", { plannedDate: monday })],
      today: monday,
    });

    expect(plan.days[1]).toMatchObject({ completed: 0, planned: 0 });
    expect(plan.days[1].rate).toBeNull();
  });

  it("leaves a week without any planned task without a rate", () => {
    const plan = buildTaskWeekPlan({
      tasks: [createTask("07")],
      today: monday,
    });

    expect(plan.planned).toBe(0);
    expect(plan.rate).toBeNull();
  });

  it("ignores inbox, cancelled and archived tasks", () => {
    const inbox = createTask("08");
    const deadlineOnly = createTask("09", {
      dueAt: "2026-03-31T08:00:00.000Z",
    });
    const cancelled = createTask("10", {
      plannedDate: monday,
      status: "cancelled",
    });
    const archived = createTask("11", {
      archivedAt: "2026-03-30T08:00:00.000Z",
      plannedDate: monday,
    });

    const plan = buildTaskWeekPlan({
      tasks: [inbox, deadlineOnly, cancelled, archived],
      today: monday,
    });

    expect(plan.planned).toBe(0);
    expect(plan.days.every((day) => day.tasks.length === 0)).toBe(true);
  });

  it("sorts open work before finished work and high priority first", () => {
    const done = createTask("12", {
      completedAt: "2026-03-30T10:00:00.000Z",
      plannedDate: monday,
      status: "completed",
    });
    const normal = createTask("13", { plannedDate: monday });
    const high = createTask("14", { plannedDate: monday, priority: "high" });

    const plan = buildTaskWeekPlan({
      tasks: [done, normal, high],
      today: monday,
    });

    expect(plan.days[0].tasks).toEqual([high, normal, done]);
  });

  it("marks today inside the week", () => {
    const plan = buildTaskWeekPlan({ tasks: [], today: "2026-04-01" });

    expect(plan.days.filter((day) => day.isToday)).toHaveLength(1);
    expect(plan.days[2].isToday).toBe(true);
  });
});

/*
 * Arbeitsbudget, Issue #124. Der Wochenplan liest die gesamte Aufgabenliste;
 * gemessen wird die Zahl der Feldzugriffe, nicht die Wanduhrzeit.
 */
describe("buildTaskWeekPlan – Arbeitsbudget", () => {
  function measure(taskCount: number): number {
    const counter = createAccessCounter();
    const tasks = Array.from({ length: taskCount }, (_, index) =>
      createTask(String(index).padStart(2, "0"), {
        id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
        // Zwei Wochen Plandaten: Die Hälfte fällt in die gezeigte Woche.
        plannedDate: addCalendarDays(monday, index % 14),
      }),
    );

    buildTaskWeekPlan({
      tasks: countPropertyReads(tasks, counter),
      today: monday,
    });
    return counter.reads;
  }

  it("stays inside the documented budget for a large list", () => {
    // 3.000 Aufgaben: gemessen 38.976 Zugriffe, dokumentiert in
    // `docs/KNOWN_LIMITATIONS.md`.
    expect(measure(3_000)).toBeLessThan(60_000);
  });

  it("grows linearly with the list, not with the days times the list", () => {
    const single = measure(3_000);
    const double = measure(6_000);

    /*
     * Der Tagesaufbau arbeitet auf der bereits gefilterten Woche. Verdoppelt
     * sich die Liste, verdoppelt sich die Arbeit — sie vervierzehnfacht sich
     * nicht.
     */
    expect(double).toBeLessThanOrEqual(single * 2.2);
  });
});

function createTask(suffix: string, overrides: Partial<Task> = {}): Task {
  const createdAt = overrides.createdAt ?? "2026-03-30T09:00:00.000Z";
  return {
    id: `00000000-0000-4000-8000-0000000009${suffix}`,
    createdAt,
    updatedAt: overrides.updatedAt ?? createdAt,
    priority: "normal",
    status: "open",
    title: `Synthetische Aufgabe ${suffix}`,
    ...overrides,
  };
}
