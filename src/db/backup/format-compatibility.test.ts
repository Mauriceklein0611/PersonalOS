import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { backupDataFixture } from "../../test/fixtures/backup";
import { createTestDatabase, deleteTestDatabase } from "../../test/database";
import type { PersonalOsDatabase } from "../database";
import { personalOsTableNamesV1 } from "../schema";
import { backupFormatVersion, createBackupEnvelope } from "./format";
import { createBackupService } from "./service";

let database: PersonalOsDatabase;

beforeEach(async () => {
  database = await createTestDatabase();
});

afterEach(async () => {
  await deleteTestDatabase(database);
});

const exportedAt = "2026-08-20T10:00:00.000Z";

/**
 * Ein Export im Format 1 kennt `hiddenInsights` nicht — weder in den Daten
 * noch in den Zahlen. Er muss weiterhin lesbar bleiben, siehe
 * [ADR 0010](../../../docs/decisions/0010-deterministic-insights-v1.md).
 */
function createVersionOneBackup() {
  const data = Object.fromEntries(
    personalOsTableNamesV1.map((tableName) => [
      tableName,
      backupDataFixture[tableName],
    ]),
  );
  const counts = Object.fromEntries(
    personalOsTableNamesV1.map((tableName) => [
      tableName,
      backupDataFixture[tableName].length,
    ]),
  );

  return {
    appVersion: "0.1.0",
    counts,
    data,
    exportedAt,
    format: "personalos",
    formatVersion: 1,
    schemaVersion: 3,
  };
}

describe("Backup-Format", () => {
  it("writes new exports in version 2", () => {
    const envelope = createBackupEnvelope(exportedAt, backupDataFixture);

    expect(backupFormatVersion).toBe(2);
    expect(envelope.formatVersion).toBe(2);
    expect(envelope.counts.hiddenInsights).toBe(1);
  });

  it("still reads a version 1 export and treats it as nothing hidden", () => {
    const service = createBackupService(database);

    const preview = service.parse(JSON.stringify(createVersionOneBackup()));

    expect(preview.formatVersion).toBe(1);
    expect(preview.backup.data.hiddenInsights).toEqual([]);
    expect(preview.backup.data.tasks).toHaveLength(1);
  });

  it("restores a version 1 export without losing a record", async () => {
    const service = createBackupService(database);
    const preview = service.parse(JSON.stringify(createVersionOneBackup()));

    await service.replace(preview, () => undefined);

    expect(await database.table("tasks").count()).toBe(1);
    expect(await database.table("hiddenInsights").count()).toBe(0);
  });

  it("refuses a version 1 export that carries hidden insights anyway", () => {
    const service = createBackupService(database);
    const tampered = {
      ...createVersionOneBackup(),
      data: {
        ...createVersionOneBackup().data,
        hiddenInsights: backupDataFixture.hiddenInsights,
      },
    };

    expect(() => service.parse(JSON.stringify(tampered))).toThrow();
  });

  it("keeps the count check strict for a version 2 export", () => {
    const service = createBackupService(database);
    const envelope = createBackupEnvelope(exportedAt, backupDataFixture);
    const tampered = {
      ...envelope,
      counts: { ...envelope.counts, hiddenInsights: 99 },
    };

    expect(() => service.parse(JSON.stringify(tampered))).toThrow();
  });

  it("round-trips a version 2 export including the hidden insights", async () => {
    const service = createBackupService(database);
    const envelope = createBackupEnvelope(exportedAt, backupDataFixture);
    const preview = service.parse(JSON.stringify(envelope));

    await service.replace(preview, () => undefined);

    expect(await database.table("hiddenInsights").count()).toBe(1);
    const restored = await service.create();
    expect(restored.data.hiddenInsights).toEqual(
      backupDataFixture.hiddenInsights,
    );
  });
});
