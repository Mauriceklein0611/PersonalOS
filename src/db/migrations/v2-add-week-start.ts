import type { Transaction } from "dexie";

import { settingsSchema, settingsV1Schema } from "../schemas/settings";

export function migrateSettingsRecordToV2(value: unknown) {
  const settingsV1 = settingsV1Schema.parse(value);
  return settingsSchema.parse({
    ...settingsV1,
    weekStartsOn: 1,
  });
}

export async function migrateToVersion2(
  transaction: Transaction,
): Promise<void> {
  await transaction
    .table<unknown, string>("settings")
    .toCollection()
    .modify((settings, context) => {
      context.value = migrateSettingsRecordToV2(settings);
    });
}
