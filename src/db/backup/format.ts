import { z } from "zod";

import packageMetadata from "../../../package.json";
import { isoInstantSchema } from "../../lib/dates/date-values";
import { backupDataSchema } from "../schemas/domain-records";
import {
  personalOsSchemaVersion,
  personalOsTableNames,
  personalOsTableNamesV1,
  personalOsTableNamesV4,
  type PersonalOsTableName,
} from "../schema";

export const backupFormatVersion = 4;

/**
 * Version 1 kennt `hiddenInsights` noch nicht. Sie bleibt lesbar; die Tabelle
 * wird dann als leer gelesen. Siehe [ADR 0010](../../../docs/decisions/0010-deterministic-insights-v1.md).
 *
 * Version 3 kann `sourceTransactionId` auf einem Sparbeitrag enthalten. Die
 * Versionen 1 und 2 bleiben unverändert lesbar; ihre Beiträge sind schlicht
 * mit keiner Buchung verknüpft. Siehe
 * [ADR 0011](../../../docs/decisions/0011-savings-contribution-links-a-transaction.md).
 *
 * Version 4 kennt `recurringTransactions` und `recurringTransactionId` auf
 * einer Buchung. Die Versionen 1 bis 3 bleiben lesbar: Sie haben keine
 * Vorlagen, und ihre Buchungen sind allesamt von Hand erfasst. Siehe
 * [ADR 0013](../../../docs/decisions/0013-recurring-transactions-are-confirmed-templates.md).
 */
export const supportedBackupFormatVersions = [1, 2, 3, 4] as const;

export const maximumBackupBytes = 10_000_000;

const tableNameSchema = z.enum(personalOsTableNames);
/**
 * Teilweise, weil ein Export im Format 1 keine Zahl für `hiddenInsights`
 * enthält. Welche Zahlen Pflicht sind, entscheidet die Formatversion beim
 * Prüfen — nicht das Schema.
 */
const countSchema = z.partialRecord(tableNameSchema, z.int().nonnegative());

export const personalOsBackupSchema = z
  .object({
    format: z.literal("personalos"),
    formatVersion: z.union([
      z.literal(1),
      z.literal(2),
      z.literal(3),
      z.literal(4),
    ]),
    schemaVersion: z.int().positive(),
    exportedAt: isoInstantSchema,
    appVersion: z.string().min(1).max(100),
    counts: countSchema,
    data: backupDataSchema,
  })
  .strict();

export type PersonalOsBackup = z.infer<typeof personalOsBackupSchema>;
export type BackupFormatVersion = PersonalOsBackup["formatVersion"];

/**
 * Die Tabellen, für die eine Formatversion eine Datensatzzahl nennen muss.
 * Eine ältere Version kann nur zählen, was sie kennt: Format 1 kennt weder
 * `hiddenInsights` noch die Vorlagen, die Formate 2 und 3 kennen die Vorlagen
 * nicht.
 */
export function countedTableNames(
  formatVersion: BackupFormatVersion,
): readonly PersonalOsTableName[] {
  if (formatVersion === 1) return personalOsTableNamesV1;
  return formatVersion === 4 ? personalOsTableNames : personalOsTableNamesV4;
}

export function createBackupEnvelope(
  exportedAt: string,
  data: PersonalOsBackup["data"],
): PersonalOsBackup {
  const counts = Object.fromEntries(
    personalOsTableNames.map((tableName) => [
      tableName,
      data[tableName].length,
    ]),
  ) as PersonalOsBackup["counts"];

  return personalOsBackupSchema.parse({
    format: "personalos",
    formatVersion: backupFormatVersion,
    schemaVersion: personalOsSchemaVersion,
    exportedAt,
    appVersion: packageMetadata.version,
    counts,
    data,
  });
}

export function createBackupFilename(exportedAt: string): string {
  const safeTimestamp = isoInstantSchema
    .parse(exportedAt)
    .replace(/[-:.]/g, "");
  return `personalos-backup-${safeTimestamp}.json`;
}
