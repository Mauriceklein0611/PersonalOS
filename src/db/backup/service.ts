import {
  createIsoInstant,
  systemClock,
  type Clock,
} from "../../lib/dates/date-values";
import { personalOsDatabase, type PersonalOsDatabase } from "../database";
import { toPersistenceError } from "../errors";
import { personalOsTableNames } from "../schema";
import { backupDataSchema, type BackupData } from "../schemas/domain-records";
import {
  countedTableNames,
  createBackupEnvelope,
  maximumBackupBytes,
  personalOsBackupSchema,
  type PersonalOsBackup,
} from "./format";
import { assertBackupIntegrity, BackupIntegrityError } from "./integrity";

export type BackupPreview = {
  backup: PersonalOsBackup;
  counts: PersonalOsBackup["counts"];
  exportedAt: string;
  formatVersion: number;
  period?: { from: string; to: string };
  totalRecords: number;
  warnings: string[];
};

export interface BackupService {
  create(): Promise<PersonalOsBackup>;
  parse(json: string): BackupPreview;
  replace(
    preview: BackupPreview,
    onSafetyBackup: (backup: PersonalOsBackup) => void | Promise<void>,
  ): Promise<void>;
}

export function createBackupService(
  database: PersonalOsDatabase,
  clock: Clock = systemClock,
): BackupService {
  return {
    async create() {
      try {
        const data = await readAllTables(database);
        assertBackupIntegrity(data);
        return createBackupEnvelope(createIsoInstant(clock.now()), data);
      } catch (error) {
        throw toPersistenceError(error, "validation");
      }
    },
    parse(json) {
      if (new TextEncoder().encode(json).byteLength > maximumBackupBytes) {
        throw new BackupIntegrityError();
      }

      let input: unknown;
      try {
        input = JSON.parse(json);
      } catch (error) {
        throw new BackupIntegrityError({ cause: error });
      }

      assertNoPrototypeKeys(input);
      const backup = personalOsBackupSchema.parse(input);
      assertCounts(backup);
      assertBackupIntegrity(backup.data);
      return createPreview(backup);
    },
    async replace(preview, onSafetyBackup) {
      const backup = personalOsBackupSchema.parse(preview.backup);
      assertCounts(backup);
      assertBackupIntegrity(backup.data);

      const safetyBackup = await this.create();
      await onSafetyBackup(safetyBackup);

      try {
        const tables = personalOsTableNames.map((name) => database.table(name));
        await database.transaction("rw", tables, async () => {
          for (const tableName of personalOsTableNames) {
            await database.table(tableName).clear();
            if (backup.data[tableName].length > 0) {
              await database.table(tableName).bulkAdd(backup.data[tableName]);
            }
          }

          const restored = await readAllTables(database);
          assertBackupIntegrity(restored);
          assertDataMatches(backup.data, restored);
        });
      } catch (error) {
        throw toPersistenceError(error, "transaction");
      }
    },
  };
}

export const personalOsBackupService = createBackupService(personalOsDatabase);

async function readAllTables(
  database: PersonalOsDatabase,
): Promise<BackupData> {
  const tables = personalOsTableNames.map((name) => database.table(name));
  const rawData = await database.transaction("r", tables, async () =>
    Object.fromEntries(
      await Promise.all(
        personalOsTableNames.map(async (tableName) => [
          tableName,
          await database.table(tableName).toArray(),
        ]),
      ),
    ),
  );
  return backupDataSchema.parse(rawData);
}

/**
 * `__proto__` überlebt die strikte Feldprüfung: Zod fragt die Feldliste mit
 * `in` ab, und `"__proto__" in shape` ist wegen der geerbten Eigenschaft immer
 * wahr. Der Schlüssel gilt dadurch als bekannt und landet als eigene
 * Eigenschaft im Datensatz.
 *
 * Der Prototyp bleibt dabei unverändert — `JSON.parse` legt eine eigene
 * Eigenschaft an und verschiebt nichts. Das Feld überlebte aber Import,
 * Datenbank und jeden späteren Export, und genau das darf ein Import nicht
 * können. Die Datei wird deshalb abgelehnt, bevor irgendetwas geschrieben ist.
 * Gefunden im Datenschutz- und Sicherheitsreview, siehe
 * `docs/audits/privacy-security-review.md`.
 */
function assertNoPrototypeKeys(value: unknown): void {
  if (value === null || typeof value !== "object") {
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      assertNoPrototypeKeys(item);
    }
    return;
  }
  if (Object.hasOwn(value, "__proto__")) {
    throw new BackupIntegrityError();
  }
  for (const item of Object.values(value)) {
    assertNoPrototypeKeys(item);
  }
}

/**
 * Geprüft wird gegen die Tabellen, die die Formatversion des Backups kennt.
 * Ein Export im Format 1 nennt keine Zahl für `hiddenInsights`; dafür darf
 * die Tabelle dort auch keine Datensätze enthalten.
 */
function assertCounts(backup: PersonalOsBackup): void {
  const counted = countedTableNames(backup.formatVersion);
  for (const tableName of counted) {
    if (backup.counts[tableName] !== backup.data[tableName].length) {
      throw new BackupIntegrityError();
    }
  }

  for (const tableName of personalOsTableNames) {
    if (!counted.includes(tableName) && backup.data[tableName].length > 0) {
      throw new BackupIntegrityError();
    }
  }
}

function assertDataMatches(expected: BackupData, actual: BackupData): void {
  for (const tableName of personalOsTableNames) {
    const expectedRecords = sortRecords(expected[tableName]);
    const actualRecords = sortRecords(actual[tableName]);
    if (JSON.stringify(expectedRecords) !== JSON.stringify(actualRecords)) {
      throw new BackupIntegrityError();
    }
  }
}

type IdentifiedRecord = { id: string };
type TimestampedRecord = { createdAt: string; updatedAt: string };

function sortRecords(records: readonly IdentifiedRecord[]) {
  return [...records].sort((left, right) => left.id.localeCompare(right.id));
}

function createPreview(backup: PersonalOsBackup): BackupPreview {
  const timestamps: string[] = [];
  let totalRecords = 0;
  for (const tableName of personalOsTableNames) {
    const records: readonly TimestampedRecord[] = backup.data[tableName];
    totalRecords += records.length;
    for (const record of records) {
      timestamps.push(record.createdAt, record.updatedAt);
    }
  }
  const warnings: string[] = [];
  const sortedTimestamps = timestamps.sort();
  if (totalRecords === 0) warnings.push("Das Backup enthält keine Datensätze.");
  if (backup.data.settings.length === 0)
    warnings.push("Das Backup enthält keine Einstellungen.");

  return {
    backup,
    counts: backup.counts,
    exportedAt: backup.exportedAt,
    formatVersion: backup.formatVersion,
    period:
      sortedTimestamps.length > 0
        ? { from: sortedTimestamps[0]!, to: sortedTimestamps.at(-1)! }
        : undefined,
    totalRecords,
    warnings,
  };
}
