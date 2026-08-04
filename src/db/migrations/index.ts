import type Dexie from "dexie";

import { personalOsSchemaV1, personalOsSchemaV2 } from "../schema";
import { migrateToVersion2 } from "./v2-add-week-start";

export function registerDatabaseMigrations(database: Dexie): void {
  database.version(1).stores(personalOsSchemaV1);
  database.version(2).stores(personalOsSchemaV2).upgrade(migrateToVersion2);
}
