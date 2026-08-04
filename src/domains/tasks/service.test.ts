import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { PersonalOsDatabase } from "../../db/database";
import type { Clock } from "../../lib/dates/date-values";
import { createTestDatabase, deleteTestDatabase } from "../../test/database";
import { createTaskRepository } from "./repository";
import { createTaskService } from "./service";

const taskId = "00000000-0000-4000-8000-000000000931";
let database: PersonalOsDatabase;

beforeEach(async () => {
  database = await createTestDatabase();
});

afterEach(async () => {
  await deleteTestDatabase(database);
});

describe("task service", () => {
  it("keeps status and completion timestamp consistent", async () => {
    const clock = fixedClock("2026-08-04T10:00:00.000Z");
    const service = createTaskService(
      createTaskRepository(database, { clock, idGenerator: () => taskId }),
      clock,
    );
    await service.create({ priority: "normal", title: "  Testaufgabe  " });

    const completed = await service.complete(taskId);
    expect(completed).toMatchObject({
      completedAt: "2026-08-04T10:00:00.000Z",
      status: "completed",
      title: "Testaufgabe",
    });

    const reopened = await service.reopen(taskId);
    expect(reopened.status).toBe("open");
    expect(reopened.completedAt).toBeUndefined();

    const cancelled = await service.cancel(taskId);
    expect(cancelled.status).toBe("cancelled");
    expect(cancelled.completedAt).toBeUndefined();
  });

  it("archives and restores without permanently deleting the task", async () => {
    const clock = fixedClock("2026-08-04T10:00:00.000Z");
    const service = createTaskService(
      createTaskRepository(database, { clock, idGenerator: () => taskId }),
      clock,
    );
    await service.create({ priority: "normal", title: "Archivtest" });

    await service.archive(taskId);
    expect(await service.list()).toEqual([]);

    await service.restore(taskId);
    expect(await service.list()).toHaveLength(1);
  });
});

function fixedClock(instant: string): Clock {
  return { now: () => new Date(instant) };
}
