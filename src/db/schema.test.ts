import { afterEach, describe, expect, it } from "vitest";

import { createTestDatabase, deleteTestDatabase } from "../test/database";
import { buildEntityMeta } from "../test/factories/entity";
import type { PersonalOsDatabase } from "./database";
import { personalOsSchemaVersion, personalOsTableNames } from "./schema";

let database: PersonalOsDatabase | undefined;

afterEach(async () => {
  if (database) {
    await deleteTestDatabase(database);
    database = undefined;
  }
});

describe("database schema v1", () => {
  it("opens every documented table at the expected version", async () => {
    database = await createTestDatabase();

    expect(database.verno).toBe(personalOsSchemaVersion);
    expect(database.tables.map((table) => table.name).sort()).toEqual(
      [...personalOsTableNames].sort(),
    );
  });

  it("enforces the compound uniqueness required by daily records", async () => {
    database = await createTestDatabase();

    const habitEntryIndex = database
      .table("habitEntries")
      .schema.indexes.find((index) => index.name === "[habitId+localDate]");
    const journalDateIndex = database
      .table("journalEntries")
      .schema.indexes.find((index) => index.name === "localDate");

    expect(habitEntryIndex?.unique).toBe(true);
    expect(journalDateIndex?.unique).toBe(true);

    const entry = {
      ...buildEntityMeta(),
      habitId: "00000000-0000-4000-8000-000000000031",
      localDate: "2026-01-15",
      status: "done",
    };
    await database.table("habitEntries").add(entry);
    await expect(
      database.table("habitEntries").add({
        ...entry,
        id: "00000000-0000-4000-8000-000000000032",
      }),
    ).rejects.toMatchObject({ name: "ConstraintError" });
  });
});
