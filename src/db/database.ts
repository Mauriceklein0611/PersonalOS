import Dexie, { type Table } from "dexie";

import { registerDatabaseMigrations } from "./migrations";
import type { PersonalOsTableName } from "./schema";
import type { EntityMeta, StoredEntity } from "./types";

export const personalOsDatabaseName = "personalos";

export class PersonalOsDatabase extends Dexie {
  constructor(name = personalOsDatabaseName) {
    super(name);
    registerDatabaseMigrations(this);
  }

  tableFor<TEntity extends EntityMeta>(
    tableName: PersonalOsTableName,
  ): Table<TEntity, string> {
    return this.table<TEntity, string>(tableName);
  }
}

export const personalOsDatabase = new PersonalOsDatabase();

export type PersonalOsStoredTable = Table<StoredEntity, string>;
