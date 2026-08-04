import { describe, expect, it } from "vitest";

import type { Task } from "./model";
import {
  createTaskQueryContext,
  formatCalendarDay,
  isTaskOverdue,
  queryTasks,
} from "./queries";

const context = {
  timeZone: "Europe/Berlin",
  today: "2026-03-30",
} as const;

describe("task queries", () => {
  it("uses the requested local timezone across a DST boundary", () => {
    const dueAfterLocalMidnight = createTask("01", {
      dueAt: "2026-03-29T22:30:00.000Z",
    });

    expect(
      formatCalendarDay(new Date("2026-03-29T22:30:00.000Z"), "Europe/Berlin"),
    ).toBe("2026-03-30");
    expect(queryTasks([dueAfterLocalMidnight], "today", context)).toEqual([
      dueAfterLocalMidnight,
    ]);
    expect(isTaskOverdue(dueAfterLocalMidnight, context)).toBe(false);
  });

  it("separates inbox, today, current week, and finished tasks", () => {
    const inbox = createTask("02");
    const overdue = createTask("03", { plannedDate: "2026-03-29" });
    const sunday = createTask("04", { plannedDate: "2026-04-05" });
    const nextMonday = createTask("05", { plannedDate: "2026-04-06" });
    const completed = createTask("06", {
      completedAt: "2026-03-30T10:00:00.000Z",
      status: "completed",
    });
    const cancelled = createTask("07", { status: "cancelled" });
    const tasks = [inbox, overdue, sunday, nextMonday, completed, cancelled];

    expect(queryTasks(tasks, "inbox", context)).toEqual([inbox]);
    expect(queryTasks(tasks, "today", context)).toEqual([overdue]);
    expect(queryTasks(tasks, "week", context)).toEqual([sunday]);
    expect(queryTasks(tasks, "completed", context)).toEqual([
      completed,
      cancelled,
    ]);
  });

  it("sorts overdue and high-priority work deterministically", () => {
    const normal = createTask("08", { priority: "normal" });
    const highLater = createTask("09", {
      createdAt: "2026-03-30T10:00:00.000Z",
      priority: "high",
    });
    const highEarlier = createTask("10", {
      createdAt: "2026-03-30T09:00:00.000Z",
      priority: "high",
    });

    expect(
      queryTasks([normal, highLater, highEarlier], "inbox", context),
    ).toEqual([highEarlier, highLater, normal]);
    expect(
      createTaskQueryContext(
        new Date("2026-03-29T22:30:00.000Z"),
        "Europe/Berlin",
      ).today,
    ).toBe("2026-03-30");
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
