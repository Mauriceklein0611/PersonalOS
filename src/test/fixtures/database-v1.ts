import Dexie from "dexie";

import { personalOsSchemaV1 } from "../../db/schema";
import { buildEntityMeta } from "../factories/entity";

export const settingsV1Fixture = {
  ...buildEntityMeta(),
  locale: "de-DE",
  timeZone: "Europe/Berlin",
  theme: "system",
  baseCurrency: "EUR",
} as const;

export const incompatibleSettingsV1Fixture = {
  ...settingsV1Fixture,
  locale: "en-US",
} as const;

export async function createVersion1Database(
  name: string,
  settings: unknown = settingsV1Fixture,
): Promise<void> {
  const database = new Dexie(name);
  database.version(1).stores(personalOsSchemaV1);
  await database.open();
  await database.table("settings").add(settings);
  database.close();
}
