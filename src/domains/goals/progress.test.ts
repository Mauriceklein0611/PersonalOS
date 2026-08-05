import { describe, expect, it } from "vitest";

import type { Goal, GoalMilestone } from "./model";
import {
  calculateGoalProgress,
  canChangeGoalStatus,
  describeDeadline,
  nextMilestoneOrder,
  sortMilestones,
} from "./progress";

const goalId = "00000000-0000-4000-8000-000000003101";

function buildGoal(overrides: Partial<Goal> = {}): Goal {
  return {
    createdAt: "2026-08-01T08:00:00.000Z",
    id: goalId,
    progressMode: "milestones",
    status: "active",
    title: "Synthetisches Ziel",
    updatedAt: "2026-08-01T08:00:00.000Z",
    ...overrides,
  } as Goal;
}

function buildMilestone(
  order: number,
  overrides: Partial<GoalMilestone> = {},
): GoalMilestone {
  return {
    createdAt: "2026-08-01T08:00:00.000Z",
    goalId,
    id: `00000000-0000-4000-8000-00000000320${order}`,
    order,
    status: "open",
    title: `Meilenstein ${order}`,
    updatedAt: "2026-08-01T08:00:00.000Z",
    ...overrides,
  } as GoalMilestone;
}

describe("calculateGoalProgress", () => {
  it("counts only unarchived milestones of the goal", () => {
    const progress = calculateGoalProgress(buildGoal(), [
      buildMilestone(0, {
        completedAt: "2026-08-02T08:00:00.000Z",
        status: "completed",
      }),
      buildMilestone(1),
      buildMilestone(2, { archivedAt: "2026-08-02T08:00:00.000Z" }),
      buildMilestone(3, { goalId: "00000000-0000-4000-8000-000000009999" }),
    ]);

    expect(progress.completedCount).toBe(1);
    expect(progress.totalCount).toBe(2);
    expect(progress.ratio).toBe(0.5);
    expect(progress.basis).toBe("1 von 2 Meilensteinen abgeschlossen.");
  });

  it("stays neutral for a goal without any milestone", () => {
    const progress = calculateGoalProgress(buildGoal(), []);

    expect(progress.ratio).toBeNull();
    expect(progress.totalCount).toBe(0);
    expect(progress.basis).toBe("Noch kein Meilenstein angelegt.");
  });

  it("uses the manual value and keeps it between 0 and 100", () => {
    expect(
      calculateGoalProgress(
        buildGoal({ manualProgress: 40, progressMode: "manual" }),
        [],
      ).ratio,
    ).toBe(0.4);
    expect(
      calculateGoalProgress(
        buildGoal({ manualProgress: 250, progressMode: "manual" }),
        [],
      ).ratio,
    ).toBe(1);
    expect(
      calculateGoalProgress(
        buildGoal({ manualProgress: -10, progressMode: "manual" }),
        [],
      ).ratio,
    ).toBe(0);
  });

  it("reports no value while the manual mode has no entry", () => {
    const progress = calculateGoalProgress(
      buildGoal({ progressMode: "manual" }),
      [],
    );

    expect(progress.ratio).toBeNull();
    expect(progress.basis).toBe("Noch kein manueller Wert erfasst.");
  });

  it("ignores milestones entirely in manual mode", () => {
    const progress = calculateGoalProgress(
      buildGoal({ manualProgress: 10, progressMode: "manual" }),
      [
        buildMilestone(0, {
          completedAt: "2026-08-02T08:00:00.000Z",
          status: "completed",
        }),
      ],
    );

    expect(progress.ratio).toBe(0.1);
  });
});

describe("sortMilestones", () => {
  it("orders by position and falls back to the title", () => {
    const sorted = sortMilestones([
      buildMilestone(2, { title: "Zuletzt" }),
      buildMilestone(0, { title: "Beta" }),
      buildMilestone(0, { title: "Alpha" }),
    ]);

    expect(sorted.map((milestone) => milestone.title)).toEqual([
      "Alpha",
      "Beta",
      "Zuletzt",
    ]);
  });

  it("does not change the given array", () => {
    const milestones = [buildMilestone(1), buildMilestone(0)];
    sortMilestones(milestones);

    expect(milestones[0]?.order).toBe(1);
  });
});

describe("nextMilestoneOrder", () => {
  it("continues after the highest position", () => {
    expect(nextMilestoneOrder([])).toBe(0);
    expect(nextMilestoneOrder([buildMilestone(0), buildMilestone(4)])).toBe(5);
  });
});

describe("canChangeGoalStatus", () => {
  it("requires reactivation before leaving a final state", () => {
    expect(canChangeGoalStatus("active", "completed")).toBe(true);
    expect(canChangeGoalStatus("paused", "cancelled")).toBe(true);
    expect(canChangeGoalStatus("completed", "active")).toBe(true);
    expect(canChangeGoalStatus("completed", "cancelled")).toBe(false);
    expect(canChangeGoalStatus("cancelled", "completed")).toBe(false);
  });

  it("accepts the unchanged status", () => {
    expect(canChangeGoalStatus("active", "active")).toBe(true);
  });
});

describe("describeDeadline", () => {
  it("names a missing, upcoming, current and passed target date", () => {
    expect(describeDeadline(buildGoal(), "2026-08-05").state).toBe("none");
    expect(
      describeDeadline(buildGoal({ targetDate: "2026-09-01" }), "2026-08-05")
        .state,
    ).toBe("upcoming");
    expect(
      describeDeadline(buildGoal({ targetDate: "2026-08-05" }), "2026-08-05")
        .state,
    ).toBe("today");
    expect(
      describeDeadline(buildGoal({ targetDate: "2026-08-01" }), "2026-08-05")
        .state,
    ).toBe("passed");
  });

  it("does not treat a completed goal as overdue", () => {
    const completed = buildGoal({
      completedAt: "2026-08-03T08:00:00.000Z",
      status: "completed",
      targetDate: "2026-08-01",
    });

    expect(describeDeadline(completed, "2026-08-05").state).toBe("none");
  });
});
