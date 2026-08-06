import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createTestDatabase, deleteTestDatabase } from "../../test/database";
import { backupDataFixture } from "../../test/fixtures/backup";
import type { PersonalOsDatabase } from "../database";
import { personalOsTableNames } from "../schema";
import { backupFormatVersion, createBackupFilename } from "./format";
import { createBackupService } from "./service";

const exportInstant = "2026-08-04T08:30:00.000Z";
let database: PersonalOsDatabase;

beforeEach(async () => {
  database = await createTestDatabase();
});

afterEach(async () => {
  await deleteTestDatabase(database);
});

describe("backup service", () => {
  it("exports every supported table with counts and a safe filename", async () => {
    await seedDatabase(database, backupDataFixture);
    const service = createBackupService(database, {
      now: () => new Date(exportInstant),
    });

    const backup = await service.create();

    expect(backup.data).toEqual(backupDataFixture);
    expect(backup.exportedAt).toBe(exportInstant);
    expect(backup.counts.tasks).toBe(1);
    expect(backup.counts.settings).toBe(1);
    expect(createBackupFilename(exportInstant)).toBe(
      "personalos-backup-20260804T083000000Z.json",
    );
  });

  it("restores IDs, references and values after local deletion", async () => {
    await seedDatabase(database, backupDataFixture);
    const service = createBackupService(database, {
      now: () => new Date(exportInstant),
    });
    const backup = await service.create();

    await clearDatabase(database);
    const preview = service.parse(JSON.stringify(backup));
    let safetyBackupRecordCount = -1;
    await service.replace(preview, (safetyBackup) => {
      safetyBackupRecordCount = Object.values(safetyBackup.counts).reduce(
        (sum, count) => sum + count,
        0,
      );
    });

    const restored = await service.create();
    expect(restored.data).toEqual(backupDataFixture);
    expect(safetyBackupRecordCount).toBe(0);
  });

  it("creates a complete safety backup before replacing existing data", async () => {
    await seedDatabase(database, backupDataFixture);
    const service = createBackupService(database, {
      now: () => new Date(exportInstant),
    });
    const emptyBackup = await createEmptyBackup();
    const preview = service.parse(JSON.stringify(emptyBackup));
    let safetyBackup = emptyBackup;

    await service.replace(preview, (createdSafetyBackup) => {
      safetyBackup = createdSafetyBackup;
    });

    expect(safetyBackup.data).toEqual(backupDataFixture);
    expect((await service.create()).data.tasks).toEqual([]);
  });

  it("rolls back cleared tables when a restore write fails", async () => {
    await seedDatabase(database, backupDataFixture);
    const service = createBackupService(database, {
      now: () => new Date(exportInstant),
    });
    const preview = service.parse(JSON.stringify(await service.create()));
    vi.spyOn(database.table("tasks"), "bulkAdd").mockRejectedValueOnce(
      new Error("Simulierter Schreibfehler"),
    );

    await expect(
      service.replace(preview, () => undefined),
    ).rejects.toMatchObject({
      code: "transaction",
    });

    expect((await service.create()).data).toEqual(backupDataFixture);
  });

  it("rejects malformed, unknown and inconsistent backups before writing", async () => {
    await seedDatabase(database, backupDataFixture);
    const service = createBackupService(database);
    const validBackup = await service.create();
    const brokenReference = structuredClone(validBackup);
    brokenReference.data.habitEntries[0]!.habitId =
      "00000000-0000-4000-8000-999999999999";

    expect(() => service.parse("not json")).toThrow();
    expect(() =>
      service.parse(JSON.stringify({ ...validBackup, formatVersion: 99 })),
    ).toThrow();
    expect(() => service.parse(JSON.stringify(brokenReference))).toThrow();
    expect(() =>
      service.parse(
        JSON.stringify({
          ...validBackup,
          counts: { ...validBackup.counts, tasks: 99 },
        }),
      ),
    ).toThrow();

    expect(await database.table("tasks").count()).toBe(1);
  });

  it("previews only metadata, periods, counts and safe warnings", async () => {
    const service = createBackupService(database, {
      now: () => new Date(exportInstant),
    });
    const preview = service.parse(JSON.stringify(await service.create()));

    expect(preview).toMatchObject({
      exportedAt: exportInstant,
      formatVersion: backupFormatVersion,
      totalRecords: 0,
      warnings: [
        "Das Backup enthält keine Datensätze.",
        "Das Backup enthält keine Einstellungen.",
      ],
    });
    expect(preview).not.toHaveProperty("data");
  });
});

async function seedDatabase(
  targetDatabase: PersonalOsDatabase,
  data: typeof backupDataFixture,
) {
  for (const tableName of personalOsTableNames) {
    if (data[tableName].length > 0) {
      await targetDatabase.table(tableName).bulkAdd(data[tableName]);
    }
  }
}

async function clearDatabase(targetDatabase: PersonalOsDatabase) {
  await targetDatabase.transaction(
    "rw",
    personalOsTableNames.map((tableName) => targetDatabase.table(tableName)),
    async () => {
      for (const tableName of personalOsTableNames) {
        await targetDatabase.table(tableName).clear();
      }
    },
  );
}

async function createEmptyBackup() {
  const emptyDatabase = await createTestDatabase();
  try {
    return await createBackupService(emptyDatabase, {
      now: () => new Date(exportInstant),
    }).create();
  } finally {
    await deleteTestDatabase(emptyDatabase);
  }
}
