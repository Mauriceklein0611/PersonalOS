import type Dexie from "dexie";

import {
  personalOsSchemaV1,
  personalOsSchemaV2,
  personalOsSchemaV3,
  personalOsSchemaV4,
  personalOsSchemaV5,
} from "../schema";
import { migrateToVersion2 } from "./v2-add-week-start";
import { migrateToVersion3 } from "./v3-normalize-habit-schedules";

export function registerDatabaseMigrations(database: Dexie): void {
  database.version(1).stores(personalOsSchemaV1);
  database.version(2).stores(personalOsSchemaV2).upgrade(migrateToVersion2);
  database.version(3).stores(personalOsSchemaV3).upgrade(migrateToVersion3);
  // Version 4 legt `hiddenInsights` nur an. Es gibt keinen Bestand zu
  // überführen, deshalb bleibt der Aufstieg ohne `upgrade`.
  database.version(4).stores(personalOsSchemaV4);
  // Version 5 ergänzt nur den eindeutigen Index über `sourceTransactionId`.
  // Bestehende Beiträge haben kein Quellfeld und bleiben unverändert gültig;
  // es gibt deshalb keinen Bestand zu überführen.
  database.version(5).stores(personalOsSchemaV5);
}
