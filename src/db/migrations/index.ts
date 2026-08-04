import type Dexie from "dexie";

import {
  personalOsSchemaV1,
  personalOsSchemaV2,
  personalOsSchemaV3,
} from "../schema";
import { migrateToVersion2 } from "./v2-add-week-start";
import { migrateToVersion3 } from "./v3-normalize-habit-schedules";

export function registerDatabaseMigrations(database: Dexie): void {
  database.version(1).stores(personalOsSchemaV1);
  database.version(2).stores(personalOsSchemaV2).upgrade(migrateToVersion2);
  database.version(3).stores(personalOsSchemaV3).upgrade(migrateToVersion3);
}
