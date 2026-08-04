import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { Clock } from "../../lib/dates/date-values";
import { createTestDatabase, deleteTestDatabase } from "../../test/database";
import type { PersonalOsDatabase } from "../../db/database";
import { taskCategories } from "./model";
import { createTaskRepository } from "./repository";

const taskId = "00000000-0000-4000-8000-000000000921";
let database: PersonalOsDatabase;

beforeEach(async () => {
  database = await createTestDatabase();
});

afterEach(async () => {
  await deleteTestDatabase(database);
});

describe("task repository", () => {
  it("creates and updates validated tasks in IndexedDB", async () => {
    const repository = createTaskRepository(database, {
      clock: fixedClock("2026-08-04T10:00:00.000Z"),
      idGenerator: () => taskId,
    });

    const created = await repository.create({
      categoryId: taskCategories[1].id,
      estimatedMinutes: 25,
      plannedDate: "2026-08-05",
      priority: "high",
      title: "Synthetische Aufgabe",
    });
    const updated = await repository.update(created.id, {
      notes: "Neutrale Testnotiz",
    });

    expect(updated).toMatchObject({
      categoryId: taskCategories[1].id,
      notes: "Neutrale Testnotiz",
      status: "open",
      title: "Synthetische Aufgabe",
    });
    expect(await repository.list()).toEqual([updated]);
  });

  it("rejects invalid durations and unknown categories", async () => {
    const repository = createTaskRepository(database, {
      idGenerator: () => taskId,
    });

    await expect(
      repository.create({
        estimatedMinutes: 0,
        priority: "normal",
        title: "Synthetische Aufgabe",
      }),
    ).rejects.toMatchObject({ code: "validation" });
    await expect(
      repository.create({
        categoryId: "00000000-0000-4000-8000-000000000999",
        priority: "normal",
        title: "Synthetische Aufgabe",
      }),
    ).rejects.toMatchObject({ code: "validation" });
  });
});

function fixedClock(instant: string): Clock {
  return { now: () => new Date(instant) };
}
