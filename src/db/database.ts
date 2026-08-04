import Dexie, { type Table } from "dexie";

import {
  personalOsSchemaV1,
  personalOsSchemaVersion,
  type PersonalOsTableName,
} from "./schema";
import type { EntityMeta, StoredEntity } from "./types";

export const personalOsDatabaseName = "personalos";

export class PersonalOsDatabase extends Dexie {
  constructor(name = personalOsDatabaseName) {
    super(name);
    this.version(personalOsSchemaVersion).stores(personalOsSchemaV1);
  }

  tableFor<TEntity extends EntityMeta>(
    tableName: PersonalOsTableName,
  ): Table<TEntity, string> {
    return this.table<TEntity, string>(tableName);
  }
}

export const personalOsDatabase = new PersonalOsDatabase();

export type PersonalOsStoredTable = Table<StoredEntity, string>;
