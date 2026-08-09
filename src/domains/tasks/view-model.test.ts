import { describe, expect, it } from "vitest";

import type { Task } from "./model";
import { describeTaskTiming, getTaskDeadlineDay } from "./view-model";

const context = {
  timeZone: "Europe/Berlin",
  today: "2026-03-30",
} as const;

describe("describeTaskTiming", () => {
  it("names a missed planned date without mentioning a deadline", () => {
    const timing = describeTaskTiming(
      createTask("01", { plannedDate: "2026-03-29" }),
      context,
    );

    expect(timing.state).toBe("planElapsed");
    expect(timing.label).toBe("Plandatum verstrichen");
    expect(timing.isElapsed).toBe(true);
  });

  it("names a missed deadline without claiming a missed plan", () => {
    const timing = describeTaskTiming(
      createTask("02", { dueAt: "2026-03-28T10:00:00.000Z" }),
      context,
    );

    expect(timing.state).toBe("deadlineElapsed");
    expect(timing.label).toBe("Frist verstrichen");
    expect(timing.isElapsed).toBe(true);
  });

  it("keeps both apart when both have passed", () => {
    const timing = describeTaskTiming(
      createTask("03", {
        dueAt: "2026-03-28T10:00:00.000Z",
        plannedDate: "2026-03-29",
      }),
      context,
    );

    expect(timing.state).toBe("bothElapsed");
    expect(timing.label).toBe("Plandatum und Frist verstrichen");
  });

  // Der Kern des Issues: Eine Frist ohne Plandatum ist ein eigener Zustand.
  // Vorher las sie sich auf dem Dashboard als „Für heute geplant".
  it("marks a task that carries a deadline but no planned date", () => {
    const timing = describeTaskTiming(
      createTask("04", { dueAt: "2026-04-02T10:00:00.000Z" }),
      context,
    );

    expect(timing.state).toBe("deadlineOnly");
    expect(timing.label).toBe("Frist ohne Plandatum");
    expect(timing.isElapsed).toBe(false);
  });

  it("says a planned task for today is planned for today", () => {
    const timing = describeTaskTiming(
      createTask("05", { plannedDate: "2026-03-30" }),
      context,
    );

    expect(timing.state).toBe("planned");
    expect(timing.label).toBe("Für heute geplant");
    expect(timing.isElapsed).toBe(false);
  });

  it("describes a task without any date as undated", () => {
    const timing = describeTaskTiming(createTask("06"), context);

    expect(timing.state).toBe("unscheduled");
    expect(timing.label).toBe("Ohne Termin");
  });

  // Was erledigt ist, wird nicht rückwirkend zur Mahnung.
  it("lets no date elapse for a task that is no longer open", () => {
    for (const status of ["cancelled", "completed"] as const) {
      const timing = describeTaskTiming(
        createTask("07", {
          dueAt: "2026-03-28T10:00:00.000Z",
          plannedDate: "2026-03-29",
          status,
        }),
        context,
      );

      expect(timing.isElapsed).toBe(false);
      expect(timing.label).not.toContain("verstrichen");
    }
  });

  // Dieselbe Zeitzonengrenze, die `queries.test.ts` für `isTaskOverdue` prüft:
  // 22:30 UTC ist in Berlin bereits der Folgetag, also nichts verstrichen.
  it("resolves the deadline in the local timezone, not in UTC", () => {
    const task = createTask("08", { dueAt: "2026-03-29T22:30:00.000Z" });

    expect(getTaskDeadlineDay(task, "Europe/Berlin")).toBe("2026-03-30");
    expect(describeTaskTiming(task, context).isElapsed).toBe(false);
  });
});

function createTask(suffix: string, overrides: Partial<Task> = {}): Task {
  const createdAt = overrides.createdAt ?? "2026-03-30T09:00:00.000Z";
  return {
    id: `00000000-0000-4000-8000-0000000008${suffix}`,
    createdAt,
    updatedAt: overrides.updatedAt ?? createdAt,
    priority: "normal",
    status: "open",
    title: `Synthetische Aufgabe ${suffix}`,
    ...overrides,
  };
}
