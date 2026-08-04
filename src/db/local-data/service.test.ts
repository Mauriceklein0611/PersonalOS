import { afterEach, describe, expect, it, vi } from "vitest";

import { createBackupEnvelope } from "../backup/format";
import type { BackupService } from "../backup/service";
import type { DatabaseLifecycle } from "../lifecycle";
import { createTestDatabase, deleteTestDatabase } from "../../test/database";
import { backupDataFixture } from "../../test/fixtures/backup";
import type { PersonalOsDatabase } from "../database";
import { createLocalDataService } from "./service";

let database: PersonalOsDatabase | undefined;

afterEach(async () => {
  if (database) {
    await deleteTestDatabase(database);
    database = undefined;
  }
});

describe("local data service", () => {
  it("counts records without reading their content into the UI", async () => {
    database = await createTestDatabase();
    await database.table("tasks").add({ id: "synthetic-task" });
    await database.table("journalEntries").add({ id: "synthetic-journal" });
    const service = createLocalDataService(
      database,
      createLifecycle(),
      createBackupService(),
    );

    await expect(service.countRecords()).resolves.toBe(2);
  });

  it("downloads a safety backup before deleting the database", async () => {
    database = await createTestDatabase();
    const events: string[] = [];
    const lifecycle = createLifecycle(() => {
      events.push("reset");
    });
    const backupService = createBackupService(() => {
      events.push("create");
    });
    const service = createLocalDataService(database, lifecycle, backupService);

    await service.clearWithSafetyBackup(() => {
      events.push("download");
    });

    expect(events).toEqual(["create", "download", "reset"]);
  });

  it("keeps local data when the safety download fails", async () => {
    database = await createTestDatabase();
    const lifecycle = createLifecycle();
    const service = createLocalDataService(
      database,
      lifecycle,
      createBackupService(),
    );

    await expect(
      service.clearWithSafetyBackup(() => {
        throw new Error("simulated download failure");
      }),
    ).rejects.toThrow("simulated download failure");
    expect(lifecycle.reset).not.toHaveBeenCalled();
  });
});

function createLifecycle(onReset?: () => void): DatabaseLifecycle {
  return {
    open: vi.fn().mockResolvedValue(undefined),
    reset: vi.fn(async () => onReset?.()),
  };
}

function createBackupService(onCreate?: () => void): BackupService {
  const backup = createBackupEnvelope(
    "2026-08-04T10:00:00.000Z",
    backupDataFixture,
  );
  return {
    create: vi.fn(async () => {
      onCreate?.();
      return backup;
    }),
    parse: vi.fn(),
    replace: vi.fn(),
  };
}
