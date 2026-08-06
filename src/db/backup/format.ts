import { z } from "zod";

import packageMetadata from "../../../package.json";
import { isoInstantSchema } from "../../lib/dates/date-values";
import { backupDataSchema } from "../schemas/domain-records";
import {
  personalOsSchemaVersion,
  personalOsTableNames,
  personalOsTableNamesV1,
  type PersonalOsTableName,
} from "../schema";

export const backupFormatVersion = 2;

/**
 * Version 1 kennt `hiddenInsights` noch nicht. Sie bleibt lesbar; die Tabelle
 * wird dann als leer gelesen. Siehe [ADR 0010](../../../docs/decisions/0010-deterministic-insights-v1.md).
 */
export const supportedBackupFormatVersions = [1, 2] as const;

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
    formatVersion: z.union([z.literal(1), z.literal(2)]),
    schemaVersion: z.int().positive(),
    exportedAt: isoInstantSchema,
    appVersion: z.string().min(1).max(100),
    counts: countSchema,
    data: backupDataSchema,
  })
  .strict();

export type PersonalOsBackup = z.infer<typeof personalOsBackupSchema>;
export type BackupFormatVersion = PersonalOsBackup["formatVersion"];

/** Die Tabellen, für die eine Formatversion eine Datensatzzahl nennen muss. */
export function countedTableNames(
  formatVersion: BackupFormatVersion,
): readonly PersonalOsTableName[] {
  return formatVersion === 1 ? personalOsTableNamesV1 : personalOsTableNames;
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
