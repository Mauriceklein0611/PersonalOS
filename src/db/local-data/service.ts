import { personalOsBackupService, type BackupService } from "../backup/service";
import { personalOsDatabase, type PersonalOsDatabase } from "../database";
import {
  personalOsDatabaseLifecycle,
  type DatabaseLifecycle,
} from "../lifecycle";
import { personalOsTableNames } from "../schema";
import type { PersonalOsBackup } from "../backup/format";
import { toPersistenceError } from "../errors";

export interface LocalDataService {
  clearWithSafetyBackup(
    onSafetyBackup: (backup: PersonalOsBackup) => void | Promise<void>,
  ): Promise<void>;
  countRecords(): Promise<number>;
}

export function createLocalDataService(
  database: PersonalOsDatabase,
  lifecycle: DatabaseLifecycle,
  backupService: BackupService,
): LocalDataService {
  return {
    async clearWithSafetyBackup(onSafetyBackup) {
      const backup = await backupService.create();
      await onSafetyBackup(backup);
      await lifecycle.reset();
    },
    async countRecords() {
      try {
        const tables = personalOsTableNames.map((name) => database.table(name));
        return await database.transaction("r", tables, async () => {
          const counts = await Promise.all(
            personalOsTableNames.map((tableName) =>
              database.table(tableName).count(),
            ),
          );
          return counts.reduce((total, count) => total + count, 0);
        });
      } catch (error) {
        throw toPersistenceError(error, "storage");
      }
    },
  };
}

export const personalOsLocalDataService = createLocalDataService(
  personalOsDatabase,
  personalOsDatabaseLifecycle,
  personalOsBackupService,
);
