import Dexie from "dexie";
import { afterEach, describe, expect, it } from "vitest";

import {
  createVersion1Database,
  incompatibleSettingsV1Fixture,
  settingsV1Fixture,
} from "../../test/fixtures/database-v1";
import { PersonalOsDatabase } from "../database";
import {
  personalOsSchemaV1,
  personalOsSchemaV2,
  personalOsSchemaVersion,
} from "../schema";
import { habitSchema } from "../schemas/domain-records";
import { settingsSchema } from "../schemas/settings";
import { migrateSettingsRecordToV2 } from "./v2-add-week-start";
import { migrateHabitRecordToV3 } from "./v3-normalize-habit-schedules";

const databaseNames: string[] = [];

afterEach(async () => {
  await Promise.all(
    databaseNames.splice(0).map((databaseName) => Dexie.delete(databaseName)),
  );
});

describe("database migrations", () => {
  it("migrates a version 1 fixture exactly once", async () => {
    const name = createDatabaseName();
    await createVersion1Database(name);

    const database = new PersonalOsDatabase(name);
    await database.open();

    const migrated = settingsSchema.parse(
      await database.table("settings").get(settingsV1Fixture.id),
    );
    expect(database.verno).toBe(personalOsSchemaVersion);
    expect(migrated).toEqual({
      ...settingsV1Fixture,
      weekStartsOn: 1,
    });

    database.close();
    const reopenedDatabase = new PersonalOsDatabase(name);
    await reopenedDatabase.open();
    expect(await reopenedDatabase.table("settings").get(migrated.id)).toEqual(
      migrated,
    );
    reopenedDatabase.close();
  });

  it("keeps the version 1 database unchanged when validation fails", async () => {
    const name = createDatabaseName();
    await createVersion1Database(name, incompatibleSettingsV1Fixture);

    const currentDatabase = new PersonalOsDatabase(name);
    await expect(currentDatabase.open()).rejects.toBeInstanceOf(Error);
    currentDatabase.close();

    const legacyDatabase = new Dexie(name);
    legacyDatabase.version(1).stores(personalOsSchemaV1);
    await legacyDatabase.open();

    expect(legacyDatabase.verno).toBe(1);
    expect(
      await legacyDatabase.table("settings").get(settingsV1Fixture.id),
    ).toEqual(incompatibleSettingsV1Fixture);
    legacyDatabase.close();
  });

  it("keeps the record migration idempotent", () => {
    const migrated = migrateSettingsRecordToV2(settingsV1Fixture);

    expect(migrateSettingsRecordToV2(migrated)).toEqual(migrated);
  });

  it("normalizes legacy habit schedules and invalid end dates from v2", async () => {
    const name = createDatabaseName();
    const legacyHabit = {
      id: "00000000-0000-4000-8000-000000001301",
      createdAt: "2026-08-03T08:00:00.000Z",
      updatedAt: "2026-08-03T08:00:00.000Z",
      endDate: "2026-08-02",
      name: "Synthetische Gewohnheit",
      schedule: { kind: "weekdays", days: [5, 1, 5] },
      startDate: "2026-08-03",
    };
    const legacyDatabase = new Dexie(name);
    legacyDatabase.version(2).stores(personalOsSchemaV2);
    await legacyDatabase.open();
    await legacyDatabase.table("habits").add(legacyHabit);
    legacyDatabase.close();

    const currentDatabase = new PersonalOsDatabase(name);
    await currentDatabase.open();
    const migrated = habitSchema.parse(
      await currentDatabase.table("habits").get(legacyHabit.id),
    );

    expect(currentDatabase.verno).toBe(personalOsSchemaVersion);
    expect(migrated.endDate).toBeUndefined();
    expect(migrated.schedule).toEqual({ kind: "weekdays", days: [1, 5] });
    expect(migrateHabitRecordToV3(migrated)).toEqual(migrated);
    currentDatabase.close();
  });
});

function createDatabaseName(): string {
  const name = `personalos-migration-test-${crypto.randomUUID()}`;
  databaseNames.push(name);
  return name;
}
