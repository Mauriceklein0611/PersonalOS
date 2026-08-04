import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { PersonalOsDatabase } from "../../db/database";
import { createTestDatabase, deleteTestDatabase } from "../../test/database";
import {
  createHabitEntryRepository,
  createHabitRepository,
} from "./repository";
import { createHabitService } from "./service";

const habitId = "00000000-0000-4000-8000-000000001201";
const entryId = "00000000-0000-4000-8000-000000001202";
let database: PersonalOsDatabase;

beforeEach(async () => {
  database = await createTestDatabase();
});

afterEach(async () => {
  await deleteTestDatabase(database);
});

describe("habit service", () => {
  it("normalizes schedules and moves a daily check-in through every state", async () => {
    const service = createService();
    const habit = await service.create({
      description: "  Neutraler Testtext  ",
      name: "  Morgenroutine  ",
      schedule: { kind: "weekdays", days: [5, 1, 3] },
      startDate: "2026-08-03",
    });
    const done = await service.checkIn(habit.id, "2026-08-03", "done");
    const skipped = await service.checkIn(
      habit.id,
      "2026-08-03",
      "skipped",
      "  Bewusst ausgelassen  ",
    );

    expect(habit).toMatchObject({
      description: "Neutraler Testtext",
      name: "Morgenroutine",
      schedule: { kind: "weekdays", days: [1, 3, 5] },
    });
    expect(skipped).toMatchObject({
      id: done.id,
      note: "Bewusst ausgelassen",
      status: "skipped",
    });
    expect(await service.reopenCheckIn(habit.id, "2026-08-03")).toBe(true);
    expect(await service.listEntries(habit.id)).toEqual([]);
  });

  it("rejects check-ins outside the schedule", async () => {
    const service = createService();
    const habit = await service.create({
      name: "Montagsroutine",
      schedule: { kind: "weekdays", days: [1] },
      startDate: "2026-08-03",
    });

    await expect(
      service.checkIn(habit.id, "2026-08-04", "done"),
    ).rejects.toMatchObject({ code: "conflict" });
  });

  it("archives only the habit and preserves historical entries", async () => {
    const service = createService();
    const habit = await service.create({
      name: "Synthetische Gewohnheit",
      schedule: { kind: "daily" },
      startDate: "2026-08-03",
    });
    const entry = await service.checkIn(habit.id, "2026-08-03", "done");

    await service.archive(habit.id);

    expect(await service.list()).toEqual([]);
    expect(await service.listEntries(habit.id)).toEqual([entry]);
    expect(await database.table("habitEntries").count()).toBe(1);
  });
});

function createService() {
  return createHabitService(
    createHabitRepository(database, {
      idGenerator: () => habitId,
    }),
    createHabitEntryRepository(database, {
      idGenerator: () => entryId,
    }),
  );
}
