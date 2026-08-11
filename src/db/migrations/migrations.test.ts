import Dexie from "dexie";
import { afterEach, describe, expect, it } from "vitest";

import {
  createVersion1Database,
  incompatibleSettingsV1Fixture,
  settingsV1Fixture,
} from "../../test/fixtures/database-v1";
import {
  createVersion3Database,
  habitV3Fixture,
  settingsV3Fixture,
} from "../../test/fixtures/database-v3";
import {
  createVersion4Database,
  savingsContributionV4Fixture,
  transactionV4Fixture,
} from "../../test/fixtures/database-v4";
import {
  createVersion5Database,
  transactionV5Fixture,
} from "../../test/fixtures/database-v5";
import { PersonalOsDatabase } from "../database";
import {
  personalOsSchemaV1,
  personalOsSchemaV2,
  personalOsSchemaVersion,
} from "../schema";
import {
  habitSchema,
  savingsContributionSchema,
} from "../schemas/domain-records";
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
      name: "Synthetische Routine",
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

  /**
   * Version 3 ist die einzige Vorgängerversion, deren Aufstieg keine
   * Datenumformung enthält: v4, v5 und v6 legen nur Tabellen und Indizes an.
   * Genau deshalb muss er geprüft sein — ein Fehler darin fiele sonst nur
   * dort auf, wo zusätzlich eine Umformung läuft.
   */
  it("carries a version 3 database through the additive upgrades", async () => {
    const name = createDatabaseName();
    await createVersion3Database(name);

    const database = new PersonalOsDatabase(name);
    await database.open();

    expect(database.verno).toBe(personalOsSchemaVersion);
    // Unverändert: Der Rhythmus war auf Version 3 bereits normalisiert.
    expect(
      habitSchema.parse(await database.table("habits").get(habitV3Fixture.id)),
    ).toEqual(habitV3Fixture);
    expect(
      settingsSchema.parse(
        await database.table("settings").get(settingsV3Fixture.id),
      ),
    ).toEqual(settingsV3Fixture);
    // Die neuen Tabellen stehen bereit und sind leer, nicht erfunden.
    expect(await database.table("hiddenInsights").count()).toBe(0);
    expect(await database.table("recurringTransactions").count()).toBe(0);

    database.close();
  });

  it("keeps existing savings contributions when v5 adds the link index", async () => {
    const name = createDatabaseName();
    await createVersion4Database(name);

    const database = new PersonalOsDatabase(name);
    await database.open();
    const migrated = savingsContributionSchema.parse(
      await database
        .table("savingsContributions")
        .get(savingsContributionV4Fixture.id),
    );

    expect(database.verno).toBe(personalOsSchemaVersion);
    expect(migrated).toEqual(savingsContributionV4Fixture);
    expect(migrated.sourceTransactionId).toBeUndefined();
    database.close();
  });

  it("lets only one contribution claim the same booking", async () => {
    const name = createDatabaseName();
    await createVersion4Database(name);
    const database = new PersonalOsDatabase(name);
    await database.open();
    const table = database.table("savingsContributions");

    await table.update(savingsContributionV4Fixture.id, {
      sourceTransactionId: transactionV4Fixture.id,
    });

    await expect(
      table.add({
        ...savingsContributionV4Fixture,
        id: "00000000-0000-4000-8000-000000009505",
        sourceTransactionId: transactionV4Fixture.id,
      }),
    ).rejects.toBeInstanceOf(Error);
    // Ohne Verweis bleibt ein zweiter Beitrag jederzeit möglich.
    await table.add({
      ...savingsContributionV4Fixture,
      id: "00000000-0000-4000-8000-000000009506",
    });
    expect(await table.count()).toBe(2);
    database.close();
  });

  /**
   * Version 6 legt `recurringTransactions` an und ergänzt einen Index auf den
   * Buchungen. Beides ist rein additiv: Der Aufstieg darf keinen bestehenden
   * Datensatz anfassen. Siehe
   * [ADR 0013](../../../docs/decisions/0013-recurring-transactions-are-confirmed-templates.md).
   */
  it("adds the template store without touching a version 5 booking", async () => {
    const name = createDatabaseName();
    await createVersion5Database(name);

    const database = new PersonalOsDatabase(name);
    await database.open();

    expect(database.verno).toBe(personalOsSchemaVersion);
    expect(await database.table("recurringTransactions").count()).toBe(0);
    // Unverändert, insbesondere ohne erfundenes `recurringTransactionId`.
    expect(
      await database.table("transactions").get(transactionV5Fixture.id),
    ).toEqual(transactionV5Fixture);

    database.close();
  });

  // Eine Vorlage erzeugt über die Monate hinweg viele Buchungen; der Index
  // darf sie deshalb nicht auf eine einzige begrenzen.
  it("lets many bookings point at the same template", async () => {
    const name = createDatabaseName();
    await createVersion5Database(name);
    const database = new PersonalOsDatabase(name);
    await database.open();
    const table = database.table("transactions");
    const templateId = "00000000-0000-4000-8000-000000009603";

    for (const [index, bookedOn] of ["2026-08-01", "2026-09-01"].entries()) {
      await table.add({
        ...transactionV5Fixture,
        bookedOn,
        id: `00000000-0000-4000-8000-00000000961${index}`,
        recurringTransactionId: templateId,
      });
    }

    expect(
      await table.where("recurringTransactionId").equals(templateId).count(),
    ).toBe(2);
    database.close();
  });
});

function createDatabaseName(): string {
  const name = `personalos-migration-test-${crypto.randomUUID()}`;
  databaseNames.push(name);
  return name;
}
