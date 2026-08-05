import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { PersonalOsDatabase } from "../../db/database";
import { createTestDatabase, deleteTestDatabase } from "../../test/database";
import type { Habit } from "../habits/model";
import { createHabitRepository } from "../habits/repository";
import type { Task } from "../tasks/model";
import { createTaskRepository } from "../tasks/repository";
import { createGoalLinkService } from "./link-service";
import {
  collectReferencingIds,
  describeGoalLinks,
  summarizeGoalLinks,
} from "./links";
import type { Goal } from "./model";
import {
  createGoalMilestoneRepository,
  createGoalRepository,
} from "./repository";

const goalId = "00000000-0000-4000-8000-000000004101";

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

function buildTask(overrides: Partial<Task> = {}): Task {
  return {
    createdAt: "2026-08-01T08:00:00.000Z",
    id: "00000000-0000-4000-8000-000000004201",
    priority: "normal",
    status: "open",
    title: "Synthetische Aufgabe",
    updatedAt: "2026-08-01T08:00:00.000Z",
    ...overrides,
  } as Task;
}

function buildHabit(overrides: Partial<Habit> = {}): Habit {
  return {
    createdAt: "2026-08-01T08:00:00.000Z",
    id: "00000000-0000-4000-8000-000000004301",
    name: "Synthetische Gewohnheit",
    schedule: { kind: "daily" },
    startDate: "2026-08-01",
    updatedAt: "2026-08-01T08:00:00.000Z",
    ...overrides,
  } as Habit;
}

describe("summarizeGoalLinks", () => {
  it("counts only unarchived items of this goal", () => {
    const summary = summarizeGoalLinks(
      buildGoal(),
      [
        buildTask({ goalId }),
        buildTask({
          goalId,
          id: "00000000-0000-4000-8000-000000004202",
          status: "completed",
          completedAt: "2026-08-02T08:00:00.000Z",
        }),
        buildTask({
          archivedAt: "2026-08-02T08:00:00.000Z",
          goalId,
          id: "00000000-0000-4000-8000-000000004203",
        }),
        buildTask({ id: "00000000-0000-4000-8000-000000004204" }),
      ],
      [buildHabit({ goalId })],
    );

    expect(summary.openTaskCount).toBe(1);
    expect(summary.completedTaskCount).toBe(1);
    expect(summary.activeHabitCount).toBe(1);
    expect(describeGoalLinks(summary)).toBe(
      "Verknüpft: 2 Aufgaben, davon 1 erledigt · 1 Gewohnheit.",
    );
  });

  it("says plainly when nothing is linked", () => {
    const summary = summarizeGoalLinks(buildGoal(), [buildTask()], []);

    expect(summary.openTaskCount).toBe(0);
    expect(describeGoalLinks(summary)).toBe(
      "Noch nichts mit diesem Ziel verknüpft.",
    );
  });

  it("includes archived items when collecting references to resolve", () => {
    const references = collectReferencingIds(
      buildGoal(),
      [
        buildTask({ goalId }),
        buildTask({
          archivedAt: "2026-08-02T08:00:00.000Z",
          goalId,
          id: "00000000-0000-4000-8000-000000004203",
        }),
      ],
      [buildHabit({ goalId })],
    );

    expect(references.taskIds).toHaveLength(2);
    expect(references.habitIds).toHaveLength(1);
  });
});

describe("goal link service", () => {
  let database: PersonalOsDatabase;

  beforeEach(async () => {
    database = await createTestDatabase();
  });

  afterEach(async () => {
    await deleteTestDatabase(database);
  });

  function buildServices() {
    const goals = createGoalRepository(database);
    const milestones = createGoalMilestoneRepository(database);
    const tasks = createTaskRepository(database);
    const habits = createHabitRepository(database);
    const links = createGoalLinkService({
      database,
      goals,
      habits,
      milestones,
      tasks,
    });
    return { goals, habits, links, milestones, tasks };
  }

  it("keeps tasks and habits but clears their reference on hard delete", async () => {
    const { goals, habits, links, milestones, tasks } = buildServices();
    const goal = await goals.create({
      progressMode: "milestones",
      status: "active",
      title: "Synthetisches Ziel",
    });
    await milestones.create({
      goalId: goal.id,
      order: 0,
      status: "open",
      title: "Erster Schritt",
    });
    const task = await tasks.create({
      goalId: goal.id,
      priority: "normal",
      title: "Synthetische Aufgabe",
    });
    const habit = await habits.create({
      goalId: goal.id,
      name: "Synthetische Gewohnheit",
      schedule: { kind: "daily" },
      startDate: "2026-08-01",
    });

    const result = await links.deleteGoalPermanently(goal);

    expect(result).toEqual({
      clearedHabitCount: 1,
      clearedTaskCount: 1,
      removedMilestoneCount: 1,
    });
    expect(await goals.get(goal.id)).toBeUndefined();
    expect(await milestones.listForGoal(goal.id)).toHaveLength(0);

    const storedTask = await tasks.require(task.id);
    const storedHabit = await habits.require(habit.id);
    expect(storedTask.title).toBe("Synthetische Aufgabe");
    expect(storedTask.goalId).toBeUndefined();
    expect(storedHabit.name).toBe("Synthetische Gewohnheit");
    expect(storedHabit.goalId).toBeUndefined();
  });

  it("leaves tasks and habits untouched when a goal is only archived", async () => {
    const { goals, habits, links, tasks } = buildServices();
    const goal = await goals.create({
      progressMode: "milestones",
      status: "active",
      title: "Synthetisches Ziel",
    });
    const task = await tasks.create({
      goalId: goal.id,
      priority: "normal",
      title: "Synthetische Aufgabe",
    });
    const habit = await habits.create({
      goalId: goal.id,
      name: "Synthetische Gewohnheit",
      schedule: { kind: "daily" },
      startDate: "2026-08-01",
    });

    await goals.archive(goal.id);

    expect((await tasks.require(task.id)).goalId).toBe(goal.id);
    expect((await habits.require(habit.id)).goalId).toBe(goal.id);
    expect(await links.countReferences(goal)).toEqual({ habits: 1, tasks: 1 });
  });

  it("offers only active and paused goals for selection", async () => {
    const { goals, links } = buildServices();
    await goals.create({
      progressMode: "milestones",
      status: "active",
      title: "Aktives Ziel",
    });
    const paused = await goals.create({
      progressMode: "milestones",
      status: "paused",
      title: "Pausiertes Ziel",
    });
    const cancelled = await goals.create({
      progressMode: "milestones",
      status: "cancelled",
      title: "Beendetes Ziel",
    });

    const options = await links.listGoalOptions();

    expect(options.map((option) => option.title).sort()).toEqual([
      "Aktives Ziel",
      "Pausiertes Ziel",
    ]);
    expect(options.some((option) => option.id === paused.id)).toBe(true);
    expect(options.some((option) => option.id === cancelled.id)).toBe(false);
  });
});
