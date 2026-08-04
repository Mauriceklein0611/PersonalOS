import { z } from "zod";

import packageMetadata from "../../../package.json";
import { isoInstantSchema } from "../../lib/dates/date-values";
import { backupDataSchema } from "../schemas/domain-records";
import { personalOsSchemaVersion, personalOsTableNames } from "../schema";

export const backupFormatVersion = 1;
export const maximumBackupBytes = 10_000_000;

const tableNameSchema = z.enum(personalOsTableNames);
const countSchema = z.record(tableNameSchema, z.int().nonnegative());

export const personalOsBackupSchema = z
  .object({
    format: z.literal("personalos"),
    formatVersion: z.literal(backupFormatVersion),
    schemaVersion: z.int().positive(),
    exportedAt: isoInstantSchema,
    appVersion: z.string().min(1).max(100),
    counts: countSchema,
    data: backupDataSchema,
  })
  .strict();

export type PersonalOsBackup = z.infer<typeof personalOsBackupSchema>;

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
