import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { PersonalOsDatabase } from "../../db/database";
import { PersistenceError } from "../../db/errors";
import { createTestDatabase, deleteTestDatabase } from "../../test/database";
import { calculateGoalProgress } from "./progress";
import {
  createGoalMilestoneRepository,
  createGoalRepository,
} from "./repository";
import { createGoalService } from "./service";

let database: PersonalOsDatabase;

beforeEach(async () => {
  database = await createTestDatabase();
});

afterEach(async () => {
  await deleteTestDatabase(database);
});

function buildService() {
  return createGoalService(
    createGoalRepository(database),
    createGoalMilestoneRepository(database),
    () => "2026-08-05T09:00:00.000Z",
  );
}

async function createGoal(mode: "manual" | "milestones" = "milestones") {
  const service = buildService();
  const goal = await service.create({
    progressMode: mode,
    status: "active",
    title: "Synthetisches Ziel",
  });
  return { goal, service };
}

describe("goal status", () => {
  it("sets completedAt together with the completed status", async () => {
    const { goal, service } = await createGoal();

    const completed = await service.changeStatus(goal.id, "completed");
    expect(completed.status).toBe("completed");
    expect(completed.completedAt).toBe("2026-08-05T09:00:00.000Z");

    const reopened = await service.changeStatus(goal.id, "active");
    expect(reopened.status).toBe("active");
    expect(reopened.completedAt).toBeUndefined();
  });

  it("refuses a jump between two final states", async () => {
    const { goal, service } = await createGoal();
    await service.changeStatus(goal.id, "completed");

    await expect(
      service.changeStatus(goal.id, "cancelled"),
    ).rejects.toBeInstanceOf(PersistenceError);
  });

  it("keeps a paused goal reachable in both directions", async () => {
    const { goal, service } = await createGoal();

    expect((await service.changeStatus(goal.id, "paused")).status).toBe(
      "paused",
    );
    expect((await service.changeStatus(goal.id, "active")).status).toBe(
      "active",
    );
  });
});

describe("milestones", () => {
  it("numbers new milestones continuously and computes progress from them", async () => {
    const { goal, service } = await createGoal();

    const first = await service.addMilestone(goal.id, "Erster Schritt");
    const second = await service.addMilestone(goal.id, "Zweiter Schritt");
    expect(first.order).toBe(0);
    expect(second.order).toBe(1);

    await service.setMilestoneStatus(first.id, "completed");
    const milestones = await service.listMilestones(goal.id);
    const progress = calculateGoalProgress(goal, milestones);

    expect(progress.ratio).toBe(0.5);
    expect(
      milestones.find((milestone) => milestone.id === first.id)?.completedAt,
    ).toBe("2026-08-05T09:00:00.000Z");
  });

  it("keeps an archived milestone readable and restorable", async () => {
    const { goal, service } = await createGoal();
    const milestone = await service.addMilestone(goal.id, "Erster Schritt");
    await service.setMilestoneStatus(milestone.id, "completed");

    const archived = await service.removeMilestone(milestone.id);
    expect(archived.archivedAt).toBeDefined();
    expect(archived.title).toBe("Erster Schritt");
    expect(archived.status).toBe("completed");

    const stored = await service.listMilestones(goal.id);
    expect(calculateGoalProgress(goal, stored).ratio).toBeNull();

    const restored = await service.restoreMilestone(milestone.id);
    expect(restored.archivedAt).toBeUndefined();
    expect(
      calculateGoalProgress(goal, await service.listMilestones(goal.id)).ratio,
    ).toBe(1);
  });

  it("rejects a milestone for an unknown goal", async () => {
    const service = buildService();

    await expect(
      service.addMilestone("00000000-0000-4000-8000-000000009999", "Ins Leere"),
    ).rejects.toBeInstanceOf(PersistenceError);
  });
});

describe("manual progress", () => {
  it("clamps the value and refuses the milestone mode", async () => {
    const { goal, service } = await createGoal("manual");

    expect((await service.setManualProgress(goal.id, 150)).manualProgress).toBe(
      100,
    );
    expect((await service.setManualProgress(goal.id, -5)).manualProgress).toBe(
      0,
    );

    const other = await service.create({
      progressMode: "milestones",
      status: "active",
      title: "Zweites Ziel",
    });
    await expect(
      service.setManualProgress(other.id, 50),
    ).rejects.toBeInstanceOf(PersistenceError);
  });

  it("drops the manual value when the mode changes", async () => {
    const { goal, service } = await createGoal("manual");
    await service.setManualProgress(goal.id, 60);

    const switched = await service.updateDetails(goal.id, {
      progressMode: "milestones",
      status: "active",
      title: "Synthetisches Ziel",
    });

    expect(switched.manualProgress).toBeUndefined();
    expect(switched.progressMode).toBe("milestones");
  });
});

describe("archiving a goal", () => {
  it("keeps the goal and its milestones readable", async () => {
    const { goal, service } = await createGoal();
    await service.addMilestone(goal.id, "Erster Schritt");

    const archived = await service.archive(goal.id);
    expect(archived.archivedAt).toBeDefined();
    expect(archived.title).toBe("Synthetisches Ziel");
    expect(await service.listMilestones(goal.id)).toHaveLength(1);

    const restored = await service.restore(goal.id);
    expect(restored.archivedAt).toBeUndefined();
  });
});
