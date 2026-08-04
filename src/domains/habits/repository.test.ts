import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { PersonalOsDatabase } from "../../db/database";
import type { Clock } from "../../lib/dates/date-values";
import { createTestDatabase, deleteTestDatabase } from "../../test/database";
import {
  createHabitEntryRepository,
  createHabitRepository,
} from "./repository";

const habitId = "00000000-0000-4000-8000-000000001101";
const entryIds = [
  "00000000-0000-4000-8000-000000001102",
  "00000000-0000-4000-8000-000000001103",
];
let database: PersonalOsDatabase;

beforeEach(async () => {
  database = await createTestDatabase();
});

afterEach(async () => {
  await deleteTestDatabase(database);
});

describe("habit repositories", () => {
  it("creates validated habits and rejects invalid schedules", async () => {
    const repository = createHabitRepository(database, {
      clock: fixedClock("2026-08-03T08:00:00.000Z"),
      idGenerator: () => habitId,
    });

    const habit = await repository.create({
      name: "Synthetische Gewohnheit",
      schedule: { kind: "weekdays", days: [1, 3, 5] },
      startDate: "2026-08-03",
    });
    expect(await repository.list()).toEqual([habit]);
    await expect(
      repository.update(habit.id, {
        endDate: "2026-08-02",
      }),
    ).rejects.toMatchObject({ code: "validation" });
  });

  it("upserts one entry per habit and local day", async () => {
    const repository = createHabitEntryRepository(database, {
      clock: sequenceClock(
        "2026-08-03T08:00:00.000Z",
        "2026-08-03T09:00:00.000Z",
      ),
      idGenerator: sequenceValues(entryIds),
    });

    const done = await repository.setForDate({
      habitId,
      localDate: "2026-08-03",
      status: "done",
    });
    const skipped = await repository.setForDate({
      habitId,
      localDate: "2026-08-03",
      note: "Neutraler Testhinweis",
      status: "skipped",
    });

    expect(skipped).toMatchObject({
      id: done.id,
      note: "Neutraler Testhinweis",
      status: "skipped",
    });
    expect(await database.table("habitEntries").count()).toBe(1);
  });

  it("lists ranges in day order and clears a check-in back to open", async () => {
    const repository = createHabitEntryRepository(database, {
      idGenerator: sequenceValues(entryIds),
    });
    await repository.setForDate({
      habitId,
      localDate: "2026-08-04",
      status: "done",
    });
    await repository.setForDate({
      habitId,
      localDate: "2026-08-03",
      status: "skipped",
    });

    expect(
      await repository.listForHabit(habitId, {
        from: "2026-08-04",
        to: "2026-08-04",
      }),
    ).toHaveLength(1);
    expect(await repository.clearForDate(habitId, "2026-08-04")).toBe(true);
    expect(await repository.getForDate(habitId, "2026-08-04")).toBeUndefined();
    expect(await repository.clearForDate(habitId, "2026-08-04")).toBe(false);
  });
});

function fixedClock(instant: string): Clock {
  return { now: () => new Date(instant) };
}

function sequenceClock(...instants: string[]): Clock {
  return { now: sequenceValues(instants, (instant) => new Date(instant)) };
}

function sequenceValues<TValue, TResult = TValue>(
  values: TValue[],
  map: (value: TValue) => TResult = (value) => value as unknown as TResult,
): () => TResult {
  let index = 0;
  return () => map(values[Math.min(index++, values.length - 1)]);
}
