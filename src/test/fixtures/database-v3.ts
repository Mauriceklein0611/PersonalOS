import Dexie from "dexie";

import { personalOsSchemaV3 } from "../../db/schema";
import { buildEntityMeta } from "../factories/entity";

/**
 * Eine Datenbank auf Version 3: Die Rhythmen sind bereits normalisiert, die
 * Tabellen `hiddenInsights` (v4) und `recurringTransactions` (v6) gibt es
 * noch nicht, und `savingsContributions` trägt den Verknüpfungsindex aus v5
 * noch nicht.
 *
 * Der Aufstieg von hier ist rein additiv. Genau das macht ihn prüfenswert:
 * Ein Fehler in einer der drei folgenden Versionen fiele sonst erst dort auf,
 * wo jemand von v1 oder v2 aufsteigt — und damit an einer Stelle, die eine
 * ganz andere Migration ausführt.
 */
export const habitV3Fixture = {
  ...buildEntityMeta({ id: "00000000-0000-4000-8000-000000009301" }),
  name: "Synthetische Routine",
  schedule: { days: [1, 3], kind: "weekdays" },
  startDate: "2026-01-01",
} as const;

export const settingsV3Fixture = {
  ...buildEntityMeta({ id: "00000000-0000-4000-8000-000000009302" }),
  baseCurrency: "EUR",
  locale: "de-DE",
  theme: "system",
  timeZone: "Europe/Berlin",
  weekStartsOn: 1,
} as const;

export async function createVersion3Database(name: string): Promise<void> {
  const database = new Dexie(name);
  database.version(3).stores(personalOsSchemaV3);
  await database.open();
  await database.table("habits").add(habitV3Fixture);
  await database.table("settings").add(settingsV3Fixture);
  database.close();
}
