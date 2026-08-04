import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { PersonalOsDatabase } from "../../db/database";
import { createTestDatabase, deleteTestDatabase } from "../../test/database";
import { createJournalRepository } from "./repository";
import { createJournalService } from "./service";

let database: PersonalOsDatabase;

beforeEach(async () => {
  database = await createTestDatabase();
});

afterEach(async () => {
  await deleteTestDatabase(database);
});

describe("journal service", () => {
  it("keeps at most one entry per local day and updates it in place", async () => {
    const service = createService();

    const created = await service.saveForDate({
      localDate: "2026-08-04",
      mood: 4,
      highlight: "Ruhiger Abend",
    });
    const updated = await service.saveForDate({
      localDate: "2026-08-04",
      mood: 3,
      stress: 2,
      highlight: "Ruhiger Abend",
    });

    expect(updated.id).toBe(created.id);
    expect(updated).toMatchObject({ mood: 3, stress: 2 });
    expect(await database.table("journalEntries").count()).toBe(1);
  });

  it("clears a value that the user removed instead of keeping the old one", async () => {
    const service = createService();
    await service.saveForDate({
      localDate: "2026-08-04",
      mood: 4,
      gratitude: "Kurzer Text",
    });

    const cleared = await service.saveForDate({
      localDate: "2026-08-04",
      gratitude: "Kurzer Text",
    });

    expect(cleared.mood).toBeUndefined();
    expect(cleared.gratitude).toBe("Kurzer Text");
  });

  it("rejects an entry without any content", async () => {
    const service = createService();

    await expect(
      service.saveForDate({ localDate: "2026-08-04", body: "   " }),
    ).rejects.toMatchObject({ code: "validation" });
    expect(await database.table("journalEntries").count()).toBe(0);
  });

  it("separates days across a day change and lists them newest first", async () => {
    const service = createService();
    await service.saveForDate({ localDate: "2026-08-03", mood: 2 });
    await service.saveForDate({ localDate: "2026-08-04", mood: 5 });

    const entries = await service.list();

    expect(entries.map((entry) => entry.localDate)).toEqual([
      "2026-08-04",
      "2026-08-03",
    ]);
    expect(await service.getForDate("2026-08-03")).toMatchObject({ mood: 2 });
    expect(await service.getForDate("2026-08-05")).toBeUndefined();
  });
});

function createService() {
  return createJournalService(createJournalRepository(database));
}
